---
paths:
  - "src/**/*"
  - "engineering/**/*.md"
  - "scripts/**/*"
  - "package.json"
---

# wallrus — scope & domain model

Canonical scope: [`engineering/SCOPE.md`](../../engineering/SCOPE.md). Architecture: [`engineering/ARCHITECTURE.md`](../../engineering/ARCHITECTURE.md). Read those for full detail.

This rule covers the **what** and **why** only. Implementation details live in topic-scoped rules:

| Touching…                                                                                    | Auto-loads    |
| -------------------------------------------------------------------------------------------- | ------------- |
| `src/lib/server/db/**`, `drizzle/**`, `migrations/**`, `**/schema.ts`                        | `database.md` |
| `src/routes/**`, `src/lib/components/**`, `**/*.svelte`, `src/app.html`, `tailwind.config.*` | `frontend.md` |
| `src/routes/api/**`, `src/hooks.server.ts`                                                   | `api.md`      |
| `src/lib/server/service/**`                                                                  | `service.md`  |
| `src/lib/server/sources/**`                                                                  | `sources.md`  |
| TS/JS/HTML / `package.json` / `bun.lock`                                                     | `bun.md`      |

## What it is

Homelab daemon. Collects wallpapers from configured sources on cron, filters per device profile, serves via WebUI + API. **Not** a wallpaper-setter — a future native/mobile app does that, consuming the API.

## Stack (one-liner)

Bun runtime + SvelteKit (Svelte 5 runes) + Tailwind v4 + shadcn-svelte + SQLite via `bun:sqlite` + Drizzle ORM. Entrypoint = commander CLI (`serve` only in MVP). Observability via `@tigorhutasuhut/telemetry-js`.

## Sources are first-party

- **No plugin system.** Sources are built-in modules under `src/lib/server/sources/<slug>.ts`. Adding a source = a PR. Reason: single-machine daemon + credentials in the same DB → running arbitrary third-party code in-process is too risky.
- Source contract details live in [`sources.md`](./sources.md).

## Domain model (do not redefine without confirmation)

- **Subscription** = `(source_slug, input_params, cron, enabled)`. Per-subscription cron, not per-source.
- **Device profile** = named target (slug, filter criteria, enabled). Filters live on **devices**, not subscriptions.
- **Device ↔ subscription is many-to-many** (join table). Either can be `enabled=false` to disable participation.
- **Image** = original blob + thumbnail (max 512×512, preserve AR), structured fields (`source_id`, `title`, `source_url`, `image_url`, `filename` (globally unique per source item), `width`, `height`, `file_size`, `format`, `tags[]`, `nsfw` 3-state, `created_at_source`, optional `search_text`). Stored on local FS.
- **Crawler bound**: `max_items_inspected` per run (counts source items yielded, **not** pages, **not** items kept). Default ~300, per-subscription overridable. No cross-run cursor — every run starts from page 1; dedup prevents re-saving.
- **Dedup key**: SHA256 + source URL.

## Fan-out semantics (subscription → device)

On image ingest, runtime evaluates the image against **all enabled devices that subscribe to the firing subscription**. Each device's filter criteria decide whether the image is admitted to that device dir (hardlink, fallback copy). On re-encounter of the same `source_url` later, eligible devices missing the image get backfilled via hardlink.

Devices added later only receive images from runs executed **after** they were added. No batch-backfill across the existing collection.

## Image lifecycle flags

- `deleted_at` — **soft-delete**. File removed from every device dir. On next crawl re-encounter of same `source_url`: cleared, file re-downloaded, fan-out re-evaluated.
- `blacklisted_at` — **permanent skip.** File removed from all devices + disk. Future crawl runs that see the same `source_url` or SHA256 are skipped at ingest. Never re-fans out.

WebUI delete action asks: _"Also blacklist?"_ — sets `blacklisted_at` if yes, `deleted_at` only if no.

## Device filter criteria (MVP, all optional per device)

Resolution min/max w/h, aspect ratio ± tolerance, file size min/max bytes, format allowlist (`jpg/png/webp/avif`), tag include/exclude lists, NSFW filter (`all` | `sfw_only` | `nsfw_only`; Unknown included in `all`, excluded from the other two).

## Storage and path scheme

- Local FS + SQLite. No object store.
- Same image fanned out across multiple device dirs via **hardlink** (fallback copy if cross-filesystem).
- On-disk layout — sync-friendly for syncthing/rsync:
  ```
  <base-dir>/<device-slug>/<source-slug>-<filename>.<ext>
  ```
- Thumbnails: `<base-dir>/.thumbs/<image-uuid>.webp`. **One per image**, not per device. Generated synchronously at ingest.

## Scheduler

- Timezone: **system**.
- Missed runs (daemon was off): **skipped**, no catch-up.
- Concurrency: subscriptions sharing the **same source** are **queued**; subscriptions on **different sources** run in **parallel**.
- On daemon startup, sweep `run_history` rows with `status = running` → mark `status = failed`, `stop_reason = daemon_crash`.

## Lifecycle rules

- Disable subscription/device → no run / no fan-out. Existing images untouched.
- Delete subscription → **soft-delete** via `subscriptions.deleted_at` so `run_history.subscription_id` FK stays valid. WebUI hides from active lists but per-subscription history page still loads. No cascade to images; explicit _"also delete all images sourced via this subscription"_ action available.
- Edit `input_params` → **in-place mutation**. `run_history.input_params_snapshot` records exact params used per run so history stays meaningful.

## Reporting (`run_history` table)

Per-run row: `id` (UUIDv7), `subscription_id`, `started_at`, `ended_at`, `status` (`running`/`success`/`failed`), `error`, `stop_reason` (`max_items_inspected` / `source_exhausted` / `error` / `daemon_crash`), `input_params_snapshot` (JSON), `items_seen`, `items_new`, `items_failed_download`, per-device add counts (JSON). Retention: last 100 runs per subscription, prune on insert.

## Globally-scoped UX state

Favorites, user tags, blacklist: **global per image**, not per device. Mobile/native client sees the same set the WebUI sees.

## Retention, observability, backup

- Retention: keep images forever. Manual delete only.
- Observability: `@tigorhutasuhut/telemetry-js` (`/bun` export). Pretty stdout on TTY, JSON otherwise. OTEL optional.
- Backup: **out of scope**. Rely on FS-level tools.
- **Deployment**: primary distribution is **Docker**. Multi-stage `Dockerfile`, runs as non-root user, exposes `:5173`, mounts data at `/data/wallrus`. `docker-compose.yml` reference ships with `WALLRUS_AUTH_ENABLE=false` (assumes reverse-proxy upstream). Bare-metal install: `bun install && bun run build && bun run src/cli.ts serve`. Default `WALLRUS_DATA_DIR=./data` for bare-metal, `/data/wallrus` for Docker. See `engineering/ARCHITECTURE.md` §Deployment.
- **User docs site**: Astro Starlight at `docs/`, deployed to GitHub Pages. See [`user-docs.md`](./user-docs.md) — must be updated whenever a user-facing env var, deployment step, config value, default, or workflow changes.

## Post-MVP — do not build, but design around

- **Collections**: named user-curated groups. WebUI + API surface (mobile sync). **Never touches FS** (DB-only). Trivially added later because of UUIDv7 PKs + soft-delete + thin service layer.
- Mobile/native app, more first-party sources, perceptual-hash dedup, pluggable storage backends, trigram FTS5 on structured fields (title, URL).
- Third-party source extensibility: not committed. Would require deciding on the sandbox model first.

## Before adding scope

If a request looks like new scope (new source kind beyond MVP set, new processing step, auto-retention, multi-user, plugin/extensibility, etc.), call it out and confirm against `engineering/SCOPE.md` before implementing.
