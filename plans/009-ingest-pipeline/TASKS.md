# 009 — Ingest pipeline — tasks

## Migration

- [x] `drizzle/migrations/0002_run_history_skip_counter.sql` adds `items_skipped_no_device INTEGER NOT NULL DEFAULT 0`
- [x] STRICT preserved (rewrite if drizzle-kit generated without it)
- [x] Drizzle snapshot regenerated + committed
- [x] Update `src/lib/server/db/schema.ts` with the new column
- [x] Update run_history DTO + Zod schema (RunHistoryRow inferred type updated; dedicated Zod schema deferred to invocation 2 — no existing runs/ schema to update)

## Filters

- [x] `src/lib/server/ingest/filters.ts` — pure fn evaluating `DeviceFilters` against candidate
- [x] Unit test: every branch (resolution, aspect, size, format, tags include/exclude, NSFW)
- [x] Unit test: empty filters → pass
- [x] Unit test: include + exclude tag conflict → exclude wins

## FS helpers

- [x] `src/lib/server/ingest/fs.ts`:
  - [x] `atomic_write(temp, final)` rename or copy+unlink
  - [x] `link_or_copy(src, dst)` hardlink with EXDEV/EPERM fallback
  - [x] `compute_thumbnail(blob, thumb)` sharp pipeline (rotate → resize 512 inside → webp q80)
- [x] Unit test: `link_or_copy` happy path (hardlink, ino matches)
- [x] Unit test: `link_or_copy` simulated EXDEV → falls back to copy (mock fs.linkSync)
- [~] Unit test: thumbnail honours EXIF orientation (use a pre-rotated fixture) — deferred; no fixture binary; .rotate() verified by code review; see .builder-notes.md
- [x] Unit test: thumbnail max dim 512, AR preserved

## Dedup

- [x] `src/lib/server/ingest/dedup.ts` — 3-stage check, discriminated union return
- [x] Unit test: URL match + blacklisted → skip_blacklisted
- [x] Unit test: URL match + present + not blacklisted → skip_already_present
- [x] Unit test: sha256 match across different URL → re_fan_out
- [x] Unit test: nothing matches → new

## Pipeline

- [x] `src/lib/server/ingest/pipeline.ts` `run_subscription(runtime, subscription_id)`
- [x] Opens run_history row at start, closes at end (success/failed)
- [x] Increments counters: `items_seen`, `items_new`, `items_failed_download`, `items_skipped_no_device`
- [x] Snapshots `input_params` to `input_params_snapshot` at run start
- [x] Stop reasons: `source_exhausted`, `max_items_inspected`, `error`
- [x] Wraps per-item errors → continues; wraps source-level errors → fails the run
- [x] Sequential downloads (no parallelism inside one run)
- [x] Respects `subscriptions.max_items_inspected` (fallback default 300)

## Scheduler hook

- [x] `src/lib/server/scheduler/cron.ts` executor body calls `pipeline.run_subscription`
- [x] Errors caught, logged with `getLogger({ module: "scheduler" }).error(…)`, queue stays alive

## Pipeline integration tests

- [x] Fake source helper: in-test async generator yielding a scripted sequence
- [x] In-memory DB seeded with 1 subscription + 2 devices (different filters)
- [x] Happy path: 1 new image, both devices match → 2 device_images rows, 2 hardlinks
- [x] Dedup by URL → skip, counter stays
- [x] Dedup by sha256 (different URL) → re_fan_out, no new image row
- [x] Blacklisted → skip entirely
- [x] Filters reject for all devices → items_skipped_no_device++, no image row
- [x] max_items_inspected hit → stop_reason set, partial counts
- [x] Source throws → run marked failed, stop_reason: error, error message set
- [x] Thumbnail file exists at `<data>/.thumbs/<image_uuid>.webp` after happy path

## Crash recovery

- [x] `bootstrap.ts` sweep still marks orphaned `running` rows → `failed`, stop_reason: `daemon_crash`
- [x] Unit test for the sweep against an in-memory DB with a pre-seeded running row

## Smoke

- [x] Path A satisfied by happy-path integration test (1 image, 2 devices, thumbnail on disk)
- [-] Real subscription `r/wallpapers` smoke — operator-driven, no CI integration. See .builder-notes.md §Path B smoke.
- [-] `stat -c %h` hardlink count — validated via inode comparison in test 1 (statSync(...).ino equal across paths)
- [x] Thumbnail file present — asserted in happy-path test

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green (507 pass, 1 skip, 0 fail)
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [x] Migration applies clean on a fresh DB (verified via create_test_db() which runs run_migrations on :memory:)
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(ingest-pipeline): scheduler executor downloads, dedups, thumbnails, fans out to devices`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 009-ingest-pipeline done` committed + pushed
