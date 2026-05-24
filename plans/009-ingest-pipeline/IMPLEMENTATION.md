# 009 — Ingest pipeline

## Status

**in-progress**

## Goal

Replace the scheduler executor stub (from 002) with the real ingest
pipeline: drive a source's async generator, dedup, download, validate
per-device filters, write blob + thumbnail, fan-out via hardlink (copy
fallback), insert image + junction rows, update run counters, honour
`max_items_inspected`.

## Decisions (pre-baked)

- **Pipeline file**: `src/lib/server/ingest/pipeline.ts` exporting
  `async function run_subscription(runtime, subscription_id)`.
  Scheduler `cron.ts` executor delegates here.
- **Dedup order** (cheapest first):
  1. `(source_id, source_url)` lookup → if present and
     `blacklisted_at IS NOT NULL`, skip (don't even download).
  2. Download → compute SHA256 streaming via `Bun.CryptoHasher`.
  3. `sha256` lookup against `images.sha256` → if existing row exists
     and is not blacklisted, fan-out re-evaluation only (no insert),
     restore from soft-delete if needed.
- **Download**: `fetch(image_url, { redirect: "follow" })` with a 30s
  timeout (`AbortSignal.timeout(30_000)`). Stream into a
  temp file under `<WALLRUS_DATA_DIR>/.tmp/<uuidv7>` (chmod 0600);
  rename once verified.
- **Thumbnail**: `sharp(temp_path).rotate().resize(512, 512, { fit:
"inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(
thumb_path)`. Thumb path =
  `<WALLRUS_DATA_DIR>/.thumbs/<image_uuid>.webp` (one per image, not per
  device).
- **Device fan-out**: query `device_subscriptions` joined with `devices`
  WHERE subscription_id = ? AND enabled = 1 → list of devices. For each,
  evaluate `DeviceFilters` (from 004) against the candidate image
  metadata. If at least one device matches:
  - Insert image row.
  - For each matching device:
    - `device_path = <WALLRUS_DATA_DIR>/<device_slug>/<source_slug>-<filename>.<ext>`
    - `fs.linkSync(blob_path, device_path)`; on `EXDEV` or `EPERM`,
      fall back to `fs.copyFileSync`.
    - Insert `device_images` row.
  - Update `run_history` counters.
- **No matching device**: delete the temp blob; record `items_skipped++`
  (new counter or repurpose `items_failed_download` — pick a new field
  if schema allows; if not, repurpose with a justification comment).
  **Decision**: extend `run_history` with `items_skipped_no_device`
  via a new migration `0002_run_history_skip_counter.sql` — STRICT,
  default 0. Update Drizzle schema + DTOs accordingly.
- **Re-encounter handling** (image already in DB):
  - If `deleted_at IS NOT NULL` and not blacklisted: clear
    `deleted_at`, re-download (file may be missing on disk), fan-out
    again.
  - If `blacklisted_at IS NOT NULL`: skip entirely.
  - Else: evaluate fan-out for any devices that now subscribe but lack
    a `device_images` row. Hardlink to those device dirs.
- **`max_items_inspected`**: enforced by the pipeline, not the source.
  The source generator is `break`-ed when the inspected counter hits
  the limit. Default 300 per `engineering/SCOPE.md`; per-subscription
  override via `subscriptions.max_items_inspected` column (already in
  schema).
- **Concurrency within a run**: sequential. Don't parallelise downloads
  inside one subscription. The scheduler's per-source queue gives
  source-level concurrency; within a run, simple is fine.
- **Errors**: source throws → mark run failed, stop_reason `error`,
  rethrow logged via telemetry. Per-item download/validate errors
  increment `items_failed_download` and continue.

## State at end of slice

- `src/lib/server/ingest/pipeline.ts`
- `src/lib/server/ingest/fs.ts` — atomic-rename, hardlink-with-fallback,
  thumbnail helpers
- `src/lib/server/ingest/dedup.ts` — the 3-step dedup logic
- `src/lib/server/ingest/filters.ts` — evaluate `DeviceFilters` against
  candidate (pure function, no IO)
- Scheduler `cron.ts` executor calls `pipeline.run_subscription`
- New migration `0002_run_history_skip_counter.sql`
- Drizzle schema updated for the new column
- Unit + integration tests with fixture sources

## Resume here

1. Read `engineering/ARCHITECTURE.md` §Ingest pipeline + §FS layout +
   §Scheduler executor.
2. **Migration**: `drizzle/migrations/0002_run_history_skip_counter.sql`:
   ```sql
   ALTER TABLE run_history
     ADD COLUMN items_skipped_no_device INTEGER NOT NULL DEFAULT 0;
   ```
   Regenerate Drizzle snapshot via `bunx drizzle-kit generate
--name run_history_skip_counter` then patch STRICT where applicable
   (per database rules).
3. **Filters** pure-fn (`filters.ts`): input `{ image_meta:
{ width, height, file_size, format, tags, nsfw } }` + `DeviceFilters`
   → `{ pass: boolean, reason?: string }`. Unit-test every branch.
4. **FS helpers** (`fs.ts`):
   - `atomic_write(temp_path, final_path)` rename or copy+unlink.
   - `link_or_copy(src, dst)` `fs.linkSync` → on EXDEV/EPERM,
     `fs.copyFileSync`.
   - `compute_thumbnail(blob_path, thumb_path)` sharp pipeline.
5. **Dedup** (`dedup.ts`): three-stage check returning a discriminated
   union (`{ kind: "skip_blacklisted" | "skip_already_present" |
"new" | "re_fan_out", existing?: ImageRow }`).
6. **Pipeline** (`pipeline.ts`):
   - Load subscription, source, device list once.
   - Open run_history row (status: running, started_at: now).
   - Iterate source generator:
     - increment `items_seen`.
     - Stage 1 dedup (URL).
     - Download to temp; compute sha256.
     - Stage 2 dedup (sha256).
     - Evaluate filters across enabled devices.
     - Branch:
       - No device matches → cleanup temp, `items_skipped_no_device++`.
       - New row → atomic_write, thumbnail, image insert, fan-out
         hardlinks, junction rows, `items_new++`.
       - Existing row (re_fan_out) → re-link missing devices,
         possibly clear `deleted_at`, `items_re_fanned_out++` (new
         counter? — actually re-use `items_seen`; add log).
     - Check `inspected_counter >= max_items_inspected` → break with
       `stop_reason: max_items_inspected`.
   - Catch error → set status `failed`, stop_reason `error`, error
     message, finalise.
   - Success → status `success`, stop_reason `source_exhausted` or
     `max_items_inspected`, ended_at: now.
7. **Scheduler hook**: `cron.ts` executor body replaced with
   `await pipeline.run_subscription(runtime, subscription_id)` (wrapped
   in try/catch to keep the queue alive).
8. **Crash-recovery sweep** in `bootstrap.ts` already exists from 001 —
   confirm it still marks `running` rows as `daemon_crash`. If schema
   evolved, fix the query.
9. Tests:
   - Pure filter fn — exhaustive branches.
   - FS helpers — hardlink, copy fallback (simulate EXDEV by mocking
     `linkSync`), thumbnail size assertion via sharp metadata.
   - Pipeline integration test using a fake source that yields a
     scripted sequence, plus an in-memory DB:
     - happy path (1 new image, 2 devices match)
     - dedup by URL skip
     - dedup by sha256 → re_fan_out
     - blacklisted skip
     - filter rejects all → items_skipped_no_device
     - max_items_inspected hit
     - source throws → run row marked failed
10. Smoke: run a real subscription pointed at a small `r/test_subreddit`,
    verify image files appear under both device dirs as hardlinks
    (`stat -c %h` returns ≥ 2).
11. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — pipeline integration cases all pass
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Migration applies clean on a fresh DB (`bunx drizzle-kit migrate`)
- [ ] Smoke: real subscription writes files; hardlink count ≥ 2 across
      devices
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(ingest-pipeline): scheduler executor downloads, dedups, thumbnails, fans out to devices
```

Body: 3-stage dedup, sharp thumbnail 512², hardlink-with-copy-fallback
fan-out, max_items_inspected, run_history counters, new migration for
`items_skipped_no_device`. Co-author. Push. Then
`chore(plans): mark 009-ingest-pipeline done`.

## Gotchas

- Temp file path must be on the same filesystem as the device dirs;
  otherwise `linkSync` will EXDEV every time and copy becomes the
  default. Default `WALLRUS_DATA_DIR` solves this — temp lives under
  the same dir.
- Sharp pipeline must call `.rotate()` BEFORE `.resize()` to honour EXIF
  orientation. Otherwise portrait photos get scaled as landscape.
- `Bun.CryptoHasher` is sync streaming; feed chunks as they arrive from
  the fetch body, don't `await response.arrayBuffer()` (would OOM on
  big files). Use `for await (const chunk of res.body)`.
- File extension detection: prefer `Content-Type` header → fall back to
  URL extension → fall back to magic-bytes via sharp `metadata().format`.
- `device_images.added_at` written as `unixepoch() * 1000`.
- The crash-recovery sweep + ingest both write to `run_history`; ensure
  the WAL+busy_timeout PRAGMAs from 001 are still applied (they are,
  per `client.ts`).
- Hardlinks share inode AND permissions; the umask must be predictable
  (0644 for images, 0755 for dirs). Set explicitly in `fs.ts`.

## Deferred

- Pause / resume runs → post-MVP.
- Distributed locking → out of scope (single daemon).
- Perceptual-hash dedup → post-MVP.
- Soft-delete reconciliation already done elsewhere → 006 marks
  `deleted_at`; this pipeline removes files when it re-encounters a
  deleted-flagged image (or actually: scope says "File removed from
  every device dir" on soft-delete — but that's a side effect of the
  delete action, not the pipeline. Confirm with SCOPE before
  implementing extra logic here).
- **Decision**: This slice does **not** implement the "delete files on
  soft-delete" behaviour. That's a follow-up slice (`014-image-fs-reconcile`
  or similar) if the operator needs it. SCOPE permits this — the
  pipeline only ADDS files; explicit DELETE flows live elsewhere.
