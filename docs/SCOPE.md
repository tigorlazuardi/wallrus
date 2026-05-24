# wallrus — Scope

Single source of truth for what wallrus is and what bounds the MVP. Update only when scope changes, not for implementation details.

> **Audience**: humans + AI agents in fresh sessions. Read this before suggesting architecture, features, or refactors.

## Purpose

Personal/homelab daemon that **collects wallpapers** from configured sources on a cron schedule, filters them per **device profile**, and serves the collection via a **WebUI + API**.

Not a CDN. Not a multi-tenant SaaS. Not an image editor. Not a wallpaper-setter (downstream native/mobile app handles that).

## Sources

- Sources are **first-party, built-in** modules under `src/sources/<name>.ts`. There is **no plugin system**, no drop-in `./plugins/` directory, no subprocess sandbox.
- Reason: single-machine homelab daemon with credentials in the same DB. The attack surface of running arbitrary third-party code in-process is too large for the value extensibility would provide. Adding a new source = a PR to this repo.
- MVP source set:
  - `reddit` — Reddit subreddits, public JSON API.
  - Booru family: `danbooru`, `gelbooru`, `safebooru`, `yandere`, `konachan`.

### Source module contract

Each source module exports:

- A unique **slug** (e.g. `reddit`, `danbooru`). Used in the on-disk path scheme and in `subscription.source_slug`.
- A **Zod schema** describing accepted `input_params` (`params_schema`). The WebUI **auto-renders a subscription form** from this Zod schema via `sveltekit-superforms`; sources do not ship UI components. JSON Schema is NOT a contract format — it is an optional export artifact, generated on demand via `z.toJSONSchema(params_schema)` for any external client (e.g. mobile/native) that wants to introspect.
- An **async generator** that, given `(input_params, credential?)`, paginates the source and yields items until the runtime's `max_items_inspected` cap is hit or pagination is exhausted.
- A manifest flag declaring whether the source supports an **elevated mode** that requires a credential. When no credential is configured for an elevated-capable source, the source still runs in **anonymous mode** (whatever the source allows unauthenticated).

### Source item shape

For each source item encountered during pagination, the source yields a structured record:

| Field | Type | Notes |
|-------|------|-------|
| `source_id` | string | Stable per-source identifier (Reddit post id, Booru post id). Required. |
| `title` | string | Source-provided title. Empty string if source has none. Required. |
| `source_url` | string | Permalink to the source post/page. Required. Part of dedup key. |
| `image_url` | string | URL the daemon downloads from. Required. |
| `filename` | string | On-disk filename (without extension; extension comes from `format`). **Must be globally unique per source item within this source** — typically `<source_id>` or a hash of it. Required. Used to build the on-disk path. |
| `width`, `height` | int | Pixel dimensions, if known up front. Optional — daemon recomputes after download. |
| `file_size` | int | Bytes, if reported by source. Optional. |
| `format` | enum (`jpg`/`png`/`webp`/`avif`) | If known up front; otherwise inferred post-download. |
| `tags` | string[] | Source-provided tags. Empty array if none. |
| `nsfw` | `sfw` \| `nsfw` \| `unknown` | Source-reported state. Source must pick one. |
| `created_at_source` | timestamp | Source-side creation time, if available. Optional. |
| `search_text` | string | **Optional.** Free-form text indexed into FTS5. Source decides content (description, tags joined, uploader). Empty = item not reachable by free-text search. |

## Subscription

A **subscription** is the unit of scheduled work. Tuple:

```
subscription = (source_slug, input_params, cron, enabled)
```

Examples:
- `reddit`, `{ subreddit: "wallpapers" }`, cron `0 9 * * *` (daily 09:00).
- `reddit`, `{ subreddit: "animewallpapers" }`, cron `0 10 * * 3,6` (Wed + Sat 10:00).
- `danbooru`, `{ tags: ["scenery", "rating:safe"] }`, cron `0 */6 * * *`.

- Per-subscription cron, not per-source.
- `enabled = false` → subscription never runs. Existing images stay.
- Editing `input_params` is an **in-place mutation**. `run_history` snapshots the exact `input_params` used per run so historical context is preserved.

## Devices

- **Multi-device profiles.** User defines N devices (e.g. `phone-pixel`, `desktop-1440p`, `tv-4k`).
- `enabled = false` → device is never considered during fan-out, even if it subscribes to active subscriptions.
- **Filters live on the device, not the subscription.** A device's filter criteria define what images are acceptable for that device.
- **Device ↔ subscription relationship is many-to-many** (join table). One subscription feeds N devices; one device draws from M subscriptions.
- On-disk path scheme:
  ```
  <base-dir>/<device-slug>/<source-slug>-<filename>.<ext>
  ```
  Friendly for syncthing/rsync (stable, descriptive filenames; per-device dir for selective sync).

### Device filter criteria (MVP)

All optional, per device:

- Resolution: `min_width`, `max_width`, `min_height`, `max_height`.
- Aspect ratio: target ratio + tolerance (e.g. `16:9 ± 5%`).
- File size: `min_bytes`, `max_bytes`.
- Format allowlist: subset of `[jpg, png, webp, avif]`.
- Tag include/exclude lists.
- NSFW: `all` (SFW + NSFW + Unknown) | `sfw_only` (SFW only, Unknown excluded) | `nsfw_only` (NSFW only, Unknown excluded).

## Fan-out (subscription → device)

When a crawler run ingests an image:

1. For the firing subscription, list all **enabled** devices that subscribe to it.
2. For each such device, evaluate the image against the device's filter criteria.
3. For every device whose filter passes, link/copy the image into that device's dir.

When a crawler **re-encounters** an image (same `source_url` already in DB):

- Re-evaluate eligible devices that don't yet have this image hardlinked, in case device set or filters changed. Backfill via hardlink (fallback copy) where appropriate.

Devices added later only receive images from runs executed **after** they were added — there is no batch-backfill across the existing collection.

## Storage

- Local filesystem + SQLite. No object store.
- Dedup key = SHA256 + source URL (identical bytes from different sources count once on disk but track provenance).
- Hardlink fan-out for same image across multiple device dirs (fallback copy if hardlink fails, e.g. cross-filesystem).
- **FTS5 virtual table** on source-supplied `search_text`. Used by WebUI gallery search. Images without `search_text` are not reachable by free-text search; metadata filters still apply.

### Image lifecycle flags

Each image row carries two independent flags:

- `deleted_at` (TIMESTAMP NULL) — **soft-delete**. File removed from disk (from every device dir). DB row stays for ref integrity. On next crawl run that re-encounters the same `source_url`: `deleted_at` cleared, file re-downloaded, fan-out re-evaluated. (Use case: *"I don't want this right now, but I'm fine seeing it again later"*.)
- `blacklisted_at` (TIMESTAMP NULL) — **permanent skip**. Removes image from **all** devices (on-disk files), DB row stays. Future crawler runs that encounter the same `source_url` or SHA256 are **skipped at ingest** — never re-downloaded, never re-fanned-out.

WebUI **Delete** action prompts: *"Also blacklist?"* If yes → set `blacklisted_at`. If no → set `deleted_at` only.

## Image processing

- **Store original.** No re-encode, no crop, no resize of the original.
- **Generate thumbnail** for WebUI: preserve aspect ratio, max 512×512.
  - Format: **webp**.
  - Location: single shared dir `<base-dir>/.thumbs/<image-uuid>.webp`. **One thumbnail per image**, not per device.
  - Timing: generated **synchronously at ingest**, before fan-out completes.
  - WebUI serves directly from this dir (or via a thin route that streams it).

## WebUI (SvelteKit)

MVP surfaces:

- Browse + filter gallery (by source, tag, device, resolution, date, **free-text search** when source populated `search_text`).
- Curate: favorite, soft-delete, blacklist, tag.
- Manage devices, subscriptions, cron schedules from UI. Subscription forms are **auto-rendered from each source's Zod `params_schema`** via `sveltekit-superforms`.
- API endpoints exposed alongside SvelteKit server routes (future mobile/native app).
- NSFW UX: **client-side blur by default**, toggle to reveal, state persisted in `localStorage`.
- Tags shown in UI distinguish **source tags** from **user tags**.
- **Favorites, user tags, and blacklist are global per image** (not per device). Mobile/native client will see the same favorites the WebUI sees.

## Code layout

- `src/lib/server/service/*` — business logic (operations). **All real work lives here.**
- `src/lib/schemas/*` — universal wire-contract schemas + DTO types (Zod). Importable from client (`.svelte`) and server alike. Server operations import their schemas from here. Mirrors the operation tree: each `src/lib/server/service/<domain>/<Op>.ts` has a sibling `src/lib/schemas/<domain>/<Op>.ts`.
- `src/sources/<slug>.ts` — first-party source modules. One file per source.
- SvelteKit server routes + API endpoints are **thin wrappers** calling services. No business logic at the HTTP layer.
- Entrypoint is a **CLI built on commander** (not a direct HTTP server). `wallrus serve` starts the HTTP+scheduler daemon.

### CLI ↔ daemon

- CLI subcommands that mutate state (subscription/device CRUD, `run-once`) talk to the running daemon over a **Unix domain socket** in the data dir (e.g. `<base-dir>/wallrus.sock`), `chmod 600`. They do **not** write the DB directly.
- The admin surface is **only** reachable via this socket. It is never exposed over network/HTTP. File permissions on the socket are the access gate; no separate token needed for admin.
- The **public API** (used by WebUI and future mobile client) is the HTTP server, gated by the env-var auth token.
- If the daemon is not running, mutating CLI commands fail with a clear error pointing the user at `wallrus serve`.

### CLI subcommands (MVP)

- `wallrus serve` — long-running daemon (HTTP + scheduler).
- `wallrus source list` — list built-in sources and their input-param schemas. (Read-only — sources are first-party code, not installable.)
- `wallrus device <add|list|remove|enable|disable>` — device profile CRUD + enable/disable.
- `wallrus subscription <add|list|remove|enable|disable>` — subscription CRUD + enable/disable.
- `wallrus run-once <subscription>` — trigger one immediate run, bypass cron. Useful for testing.

## Scheduler

- **Timezone**: system timezone.
- **Missed runs**: skipped. If the daemon was down when a cron should have fired, that fire is lost — no catch-up.
- **Concurrency rules**:
  - Runs of subscriptions sharing the **same source** are **queued** (one at a time per source, to avoid hammering a single upstream).
  - Runs of subscriptions on **different sources** run in **parallel**.

## Auth

- **Toggle**: `WALLRUS_AUTH_ENABLE` (default `true`). When `false`, **all auth processing is skipped** — no login page, no cookie check, no JWT verification, no Basic check, every route public. Intended for deployments where a reverse proxy handles auth (Authelia, Tailscale identity, OIDC). Daemon logs a loud warning at startup when auth is disabled.
- **Username + password, env-configured** (`WALLRUS_USERNAME`, `WALLRUS_PASSWORD`). Single shared credential — not multi-user.
- **WebUI**: simple HTML login page (form) → POST credentials → server timing-safe compares against env → sets httpOnly cookie. Subsequent requests gated by cookie.
- **API has three accepted credentials**:
  - `Authorization: Bearer <jwt>` — primary for mobile and future CLI.
  - `Authorization: Basic base64(user:pass)` — convenience for curl, scripts, ad-hoc testing.
  - `auth_session` cookie — accepted on `/api/v1/*` for WebUI-initiated calls.
- **Login endpoint**: `POST /api/v1/auth/login` with `{ username, password }` → `{ access_token, expires_at }`. Access token is an HS256 JWT, TTL default 30 days (configurable via `WALLRUS_JWT_TTL_DAYS`).
- **No refresh tokens.** Single-user; re-login is cheap.
- **Required env when `WALLRUS_AUTH_ENABLE` is `true` (default)**: `WALLRUS_USERNAME`, `WALLRUS_PASSWORD`, **`WALLRUS_AUTH_SECRET`** (≥32 bytes entropy). Missing or undersized → daemon refuses to start with a clear error. **No silent auto-derivation** — explicit secret prevents surprise session invalidation on redeploy.
- **When `WALLRUS_AUTH_ENABLE=false`**: all three auth env vars are optional and ignored if set. Daemon emits a single startup warning.
- **Rotation**: change `WALLRUS_AUTH_SECRET` (or username/password) and restart. Invalidates every issued JWT and every existing cookie.
- No roles. No first-run wizard.

## Source credentials

- Source API keys / OAuth tokens are stored **plaintext in SQLite**.
- Daemon enforces `chmod 600` on the DB file and `chmod 700` on the data dir at startup. Warn/refuse if wider.
- Each source declares (in its manifest) whether it has an elevated mode and what credential shape it expects. When no credential is configured for a source that supports one, the source still runs in anonymous mode.
- Backup hardening is the user's responsibility at the **backup destination layer** (restic with passphrase, age on the backup tarball, syncthing untrusted-folder encryption, etc.). Wallrus does not encrypt at the column level.
- Door stays open: if a future deployment needs column-level encryption, it can be added without schema lock-in by wrapping values. Not MVP.

## Retention

- Images: **keep forever.** Manual delete via WebUI only. Auto-prune by age, count, or quota is **out of scope**.
- Run history: keep last **100 runs per subscription** (configurable). Prune oldest on insert.

## Observability

- Library: `@tigorhutasuhut/telemetry-js`, `/bun` export.
- Pretty stdout when TTY, JSON when not.
- OTEL endpoint (optional env config) emits logs, traces, and metrics.

## Backup

**Out of scope.** Rely on filesystem tools (syncthing, rsync, restic) over the data dir + SQLite file. Path scheme is sync-friendly by design.

## Reporting (`run_history`)

A row per subscription run, persisted in SQLite, drives WebUI surfaces. Telemetry library emits structured events in parallel.

### Per-run fields

- `id` (UUIDv7), `subscription_id`.
- `started_at`, `ended_at`, `status` (`running` | `success` | `failed`), `error` (nullable).
- `stop_reason`: `max_items_inspected` | `source_exhausted` | `error` | `daemon_crash`.
- `input_params_snapshot` (JSON) — exact `input_params` used for this run. Survives later in-place edits to the subscription.
- Fetch counts: `items_seen`, `items_new`, `items_failed_download`.
- Per-device add counts: JSON `{ device_slug -> count }`. (Filter is per device, so per-device counts already encode "passed filter". Sum of per-device adds < `items_new` ⇒ image was rejected by all eligible devices.)

### UI surfaces

- Per-subscription history page (list of recent runs + counts).
- Global dashboard (today's runs, failures, total added, sparkline).
- Per-device added feed (chronological: image, subscription, when).
- Failure detail view + re-run-now button.

### Crash recovery

On daemon startup, sweep `run_history` rows with `status = running` → mark `status = failed`, `stop_reason = daemon_crash`. Affected subscriptions just wait for their next cron fire.

## Crawler bound

**Single stop condition (MVP): `max_items_inspected` per run.**

- Counts items returned by the source (Reddit posts, Booru posts) — **not** pages, **not** items kept after filter, **not** image URLs inside a listing.
- Source paginates; runtime increments the inspected counter per source item handed back.
- Stop when counter ≥ `max_items_inspected`. Mark run `success`, `stop_reason = max_items_inspected`.
- Natural stop: source exhausted (no more pages). `stop_reason = source_exhausted`.

**No cross-run cursor.** Every run starts from page 1. Dedup (SHA256 + URL) prevents re-saving but is not a stop trigger.

**Defaults**: global default (e.g. `max_items_inspected = 300`). Per-subscription override allowed.

## Subscription / device lifecycle

- **Disable** (subscription or device): `enabled = false`. Subscription stops running / device stops being a fan-out target. Existing images and history rows untouched.
- **Delete subscription**: **soft-delete via `subscriptions.deleted_at`**. The row stays so `run_history.subscription_id` FK remains valid. Active lists in WebUI hide soft-deleted subs; per-subscription history page still loads (shows name/source from the surviving row). No cascade to images. WebUI offers a separate explicit action *"also delete all images sourced via this subscription"* if the user wants cleanup.
- **Edit subscription input_params**: in-place mutation. `run_history.input_params_snapshot` preserves what each past run used.
- **Delete device**: removes device row + its on-disk dir. Image rows referenced by other devices keep those references intact.

## Database conventions

- **Primary keys**: UUIDv7 on all tables (sortable, B-tree friendly, mobile-sync friendly).
- **Secondary lookup fields** get their own indexes (`images.sha256` UNIQUE, `images.source_url` UNIQUE, partial indexes on `deleted_at` and `blacklisted_at` for images, partial index on `deleted_at` for subscriptions).
- **Full-text search** uses an SQLite **FTS5** virtual table over `images.search_text` (source-supplied, optional). Standard pattern: external-content FTS5 mirror table, kept in sync via triggers.
- **Soft-delete** flag (`deleted_at`) on images and subscriptions. **Blacklist** flag (`blacklisted_at`) on images. See *Image lifecycle flags* above.
- Hard prune is **not** an MVP feature.

## Post-MVP / planned

These shape MVP decisions but are **not built in MVP**.

### Collections

- WebUI concept: named user-curated groups of images. Many-to-many.
- **Surfaces**: WebUI + API (mobile app syncs collections).
- **Never touches FS.** Pure DB concept. No device dirs, no hardlinks, no path scheme change.
- Trivially added later because of MVP decisions: UUIDv7 PKs, soft-delete, thin service layer. New tables (`collections`, `collection_items`) + new service + new UI/API surface.

### Other future ideas (not committed)

- Mobile / native app (consumes API, handles wallpaper-set on device).
- More built-in sources (Wallhaven, Unsplash, Pexels, …) — same first-party model.
- Perceptual-hash dedup.
- Pluggable storage backends (S3, WebDAV).
- Scheduled backups, exports.
- Trigram-tokenizer FTS5 indexes for substring search on structured fields like `title` or `source_url`.
- Third-party source extensibility: revisit only if community contribution becomes a real ask. Would require deciding on the sandbox model first (subprocess + IPC + separate OS user, OS-level sandbox wrapper, etc.).
