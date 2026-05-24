# wallrus — Architecture

Companion to [`SCOPE.md`](./SCOPE.md). Scope says *what* and *why*; this doc says *how*. Update when the technical design changes, not on every implementation tweak.

> **Audience**: humans + AI agents. Read alongside `SCOPE.md` before implementing or refactoring.

## Process model

- One Bun process. Entry: `bun run cli.ts serve`.
- `cli.ts` uses **commander**. Only `serve` is implemented in MVP — other subcommands (per scope: `source list`, `device …`, `subscription …`, `run-once`) are **deferred**. WebUI + API cover everything for now; CLI returns post-MVP.
- The `serve` command bootstraps the runtime, starts the scheduler, then starts the HTTP server. Same process, async.
- Dev mode (`bun run dev`) uses Vite + SvelteKit dev server. `bootstrap.ts` guards initialisation so the scheduler runs in dev too.

## Stack picks

| Concern | Pick | Rationale |
|---------|------|-----------|
| Runtime | Bun | per scope |
| HTTP / SSR | SvelteKit + `svelte-adapter-bun` | Bun.serve native handler; falls back to `adapter-node` if a regression bites |
| CLI parser | `commander` | per scope |
| ORM | `drizzle-orm` + `drizzle-kit` | typed schema, lightweight, first-class `bun:sqlite` driver, supports hand-written migration SQL |
| SQLite driver | `bun:sqlite` | Bun built-in |
| Cron | `croner` | active, supports `nextRun()` computation, light |
| Validation | `zod` | de-facto, integrates with `zod-to-json-schema` for source param schemas |
| JSON Schema export (optional) | Zod v4 built-in `z.toJSONSchema()` (beta) | Only for external client introspection (e.g. mobile fetching source `params_schema` as JSON Schema). WebUI consumes Zod directly via Superforms — no JSON Schema in the form path. Fallback to `zod-to-json-schema` package if Zod's built-in regresses. |
| Forms | `sveltekit-superforms` + `zod` adapter | WebUI form actions; `dataType: 'json'` mode for nested data; same Zod schema as the service contract |
| Image probe + thumbnail | `sharp` | dimensions, webp encode, format detect; native libvips |
| UUID | `uuidv7` (tiny pkg) | per scope |
| Telemetry | `@tigorhutasuhut/telemetry-js` (`/bun` export) | per scope |
| Form generation (WebUI) | Hand-rolled minimal Svelte component | MVP sources need ~5 input kinds (string, number, enum, bool, array-of-strings); full json-schema-form lib is overkill |

## Directory layout

```
cli.ts                                 # commander entrypoint
src/
  app.html
  hooks.server.ts                      # auth gate + per-request telemetry span
  lib/
    server/
      bootstrap.ts                     # serve() orchestration
      env.ts                           # Zod-validated parsed config singleton
      telemetry.ts                     # @tigorhutasuhut/telemetry-js wiring
      db/
        client.ts                      # bun:sqlite + drizzle factory; applies session PRAGMAs
        schema.ts                      # all tables (drizzle)
        migrate.ts                     # migration runner (hand-written SQL via drizzle-kit migrator)
      scheduler/
        cron.ts                        # croner per-subscription next-fire registry
        queue.ts                       # per-source serial promise chain
        executor.ts                    # one subscription run, top-level orchestrator
      sources/
        _types.ts                      # SourceItem, SourceModule, SourceContext, etc.
        _registry.ts                   # collects + exports all sources keyed by slug
        reddit.ts
        danbooru.ts
        gelbooru.ts
        safebooru.ts
        yandere.ts
        konachan.ts
      service/
        image.ts                       # ingest, list, soft-delete, blacklist, tag
        device.ts                      # CRUD + enable/disable
        subscription.ts                # CRUD + soft-delete + param edit
        favorite.ts
        run.ts                         # run-once, history queries, retention prune
        source.ts                      # list registered, get schema, credential CRUD
        fanout.ts                      # device-eligibility evaluation + link/copy
        thumbnail.ts                   # sharp → webp ≤512×512 preserving AR
        filter.ts                      # pure filter evaluator (image × device.filter → bool)
      fs/
        path.ts                        # path scheme builders for staging, device dirs, thumbs
        link.ts                        # hardlink with EXDEV-fallback to copy
        perms.ts                       # chmod 700 / chmod 600 enforcer at boot
  routes/
    +layout.svelte
    +page.server.ts                    # gallery server load → service.image.list
    +page.svelte                       # gallery UI
    auth/+page.svelte                  # token entry (single shared token)
    auth/+page.server.ts               # POST → validate → set cookie
    devices/...                        # CRUD UI
    subscriptions/...                  # CRUD UI; form auto-rendered from source's Zod params_schema via Superforms
    runs/...                           # dashboard + per-subscription history
    api/v1/
      images/+server.ts
      images/[id]/+server.ts
      devices/+server.ts
      devices/[id]/+server.ts
      subscriptions/+server.ts
      subscriptions/[id]/+server.ts
      sources/+server.ts               # GET only — list registered sources + schemas
      sources/[slug]/credential/+server.ts
      runs/+server.ts
      runs/[id]/+server.ts
      runs/run-now/+server.ts          # POST { subscription_id }
drizzle/
  migrations/
    0000_pragma.sql                    # PRAGMA WAL, foreign_keys, busy_timeout, etc.
    0001_initial_schema.sql            # all tables + indexes + FTS5 + triggers
    journal.json                       # drizzle-kit migration journal
drizzle.config.ts
package.json
tsconfig.json
```

## Layer flow

```
HTTP request
  → hooks.server.ts (telemetry span, auth)
    → SvelteKit route (+page.server.ts or +server.ts)
      → zod parse body/query
        → service/* function
          → drizzle query OR fs/* OR sources/* iterator
            → telemetry event
```

```
cron tick (every 60s)
  → scheduler/cron.ts checks which subscriptions fire now
    → scheduler/queue.ts enqueues per source_slug
      → scheduler/executor.ts.execute(sub)
        → service/run.ts.start (insert run_history row)
        → sources/<slug>.fetch(ctx, params, credential)
        → per item:
          → service/image.ts.ingest_or_backfill(item)
            → service/fanout.ts.evaluate_and_link(image, sub)
              → fs/link.ts (hardlink/copy)
            → service/thumbnail.ts.generate(bytes)
        → service/run.ts.finalize (update + prune-100)
```

The HTTP and scheduler paths converge at the service layer. **No service function is HTTP-aware**; routes and the scheduler are both thin callers.

## DB schema (sketch)

All tables `STRICT`. Annotations below are SQLite-dialect shorthand; Drizzle declarations in `schema.ts` mirror this 1:1.

```sql
CREATE TABLE images (
  id              TEXT PRIMARY KEY,                            -- UUIDv7
  sha256          TEXT NOT NULL UNIQUE,
  source_slug     TEXT NOT NULL COLLATE NOCASE,
  source_id       TEXT NOT NULL,
  source_url      TEXT NOT NULL UNIQUE,
  image_url       TEXT NOT NULL,
  title           TEXT NOT NULL,
  filename        TEXT NOT NULL,                               -- source-supplied; globally unique per source
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  file_size       INTEGER NOT NULL,
  format          TEXT NOT NULL CHECK (format IN ('jpg','png','webp','avif')),
  nsfw            TEXT NOT NULL CHECK (nsfw IN ('sfw','nsfw','unknown')),
  tags_source     TEXT NOT NULL CHECK (json_valid(tags_source)),   -- JSON string[]
  search_text     TEXT,
  created_at_source INTEGER,                                   -- ms epoch
  ingested_at     INTEGER NOT NULL,
  deleted_at      INTEGER,
  blacklisted_at  INTEGER,
  aspect_ratio    REAL GENERATED ALWAYS AS (CAST(width AS REAL) / height) VIRTUAL
) STRICT;

CREATE TABLE image_user_tags (
  image_id   TEXT NOT NULL REFERENCES images(id) ON DELETE NO ACTION,
  tag        TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (image_id, tag)
) STRICT;

CREATE TABLE favorites (
  image_id     TEXT PRIMARY KEY REFERENCES images(id) ON DELETE NO ACTION,
  favorited_at INTEGER NOT NULL
) STRICT;

CREATE TABLE subscriptions (
  id                   TEXT PRIMARY KEY,                       -- UUIDv7
  source_slug          TEXT NOT NULL COLLATE NOCASE,
  name                 TEXT NOT NULL,                          -- user-facing label
  input_params         TEXT NOT NULL CHECK (json_valid(input_params)),
  cron                 TEXT NOT NULL,
  enabled              INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  max_items_inspected  INTEGER,                                -- NULL = use global default
  created_at           INTEGER NOT NULL,
  deleted_at           INTEGER
) STRICT;

CREATE TABLE source_credentials (
  source_slug TEXT PRIMARY KEY COLLATE NOCASE,
  payload     TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE devices (
  id               TEXT PRIMARY KEY,                           -- UUIDv7
  slug             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name             TEXT NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  filter_criteria  TEXT NOT NULL CHECK (json_valid(filter_criteria)),
  created_at       INTEGER NOT NULL
) STRICT;

CREATE TABLE device_subscriptions (
  device_id       TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE NO ACTION,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (device_id, subscription_id)
) STRICT;

CREATE TABLE device_images (
  device_id    TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  image_id     TEXT NOT NULL REFERENCES images(id) ON DELETE NO ACTION,
  on_disk_path TEXT NOT NULL,
  linked_at    INTEGER NOT NULL,
  PRIMARY KEY (device_id, image_id)
) STRICT;

CREATE TABLE run_history (
  id                     TEXT PRIMARY KEY,                     -- UUIDv7
  subscription_id        TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE NO ACTION,
  started_at             INTEGER NOT NULL,
  ended_at               INTEGER,
  duration_ms            INTEGER GENERATED ALWAYS AS (ended_at - started_at) VIRTUAL,
  status                 TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  error                  TEXT,
  stop_reason            TEXT CHECK (stop_reason IN ('max_items_inspected','source_exhausted','error','daemon_crash')),
  input_params_snapshot  TEXT NOT NULL CHECK (json_valid(input_params_snapshot)),
  items_seen             INTEGER NOT NULL DEFAULT 0,
  items_new              INTEGER NOT NULL DEFAULT 0,
  items_failed_download  INTEGER NOT NULL DEFAULT 0,
  device_adds            TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(device_adds))
) STRICT;
```

> **Time convention**: every timestamp column (`*_at`) stores **unix milliseconds since epoch** as `INTEGER`. Every duration column carries the explicit suffix **`_ms`** and is also `INTEGER` (millisecond precision). No `TEXT` ISO strings, no `REAL` seconds. Applies to every existing table above and every new column added in the future.
>
> - Read path: services convert to JS `Date` or ISO string only at the API boundary, not in the DB layer.
> - Write path: services use `Date.now()` to populate `*_at` fields. (DB-side defaults via `unixepoch('subsec') * 1000` are avoided so a test clock can be injected in services.)
> - `created_at_source` from sources arrives as ISO; converted to ms before insert (`Date.parse(...)`).

### Indexes (beyond PKs / UNIQUE)

```sql
-- images
CREATE INDEX idx_images_source_slug ON images(source_slug);
CREATE INDEX idx_images_ingested_at ON images(ingested_at);
CREATE INDEX idx_images_deleted_partial ON images(id) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_images_blacklisted_partial ON images(id) WHERE blacklisted_at IS NOT NULL;

-- subscriptions
CREATE INDEX idx_subs_active ON subscriptions(enabled, source_slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_subs_deleted_partial ON subscriptions(id) WHERE deleted_at IS NOT NULL;

-- run_history
CREATE INDEX idx_runs_sub_started ON run_history(subscription_id, started_at DESC);
CREATE INDEX idx_runs_status ON run_history(status); -- for crash-recovery sweep

-- junction tables: PK already covers (a, b); add reverse (b, a) for reverse lookups
CREATE INDEX idx_devsub_reverse ON device_subscriptions(subscription_id, device_id);
CREATE INDEX idx_devimg_reverse ON device_images(image_id, device_id);
CREATE INDEX idx_imgtag_reverse ON image_user_tags(tag, image_id);
```

**Rule for junction tables**: PK `(a, b)` covers lookups starting from `a`. Always add a reverse composite `(b, a)` as a non-unique index to cover lookups starting from `b`. Concrete reverse uses:

- `device_subscriptions(subscription_id, device_id)` — "which devices subscribe to this subscription?" (driven during fan-out for every run).
- `device_images(image_id, device_id)` — "which devices have this image?" (used by per-image WebUI detail, by global-delete path).
- `image_user_tags(tag, image_id)` — "images with this user tag" (gallery filter).

### FTS5

```sql
CREATE VIRTUAL TABLE images_fts USING fts5(
  search_text,
  content='images',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- triggers keep FTS in sync
CREATE TRIGGER images_ai AFTER INSERT ON images BEGIN
  INSERT INTO images_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
CREATE TRIGGER images_ad AFTER DELETE ON images BEGIN
  INSERT INTO images_fts(images_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
END;
CREATE TRIGGER images_au AFTER UPDATE ON images BEGIN
  INSERT INTO images_fts(images_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
  INSERT INTO images_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
```

## SQLite conventions

Applies to every table in this codebase and every future migration.

### 1. `STRICT` on every table

Default SQLite is flex-typed (any value lands anywhere regardless of declared type). `STRICT` enforces the declared types — a write of the wrong type errors at the boundary rather than silently coercing. Drizzle's sqlite-core has `.strict()` per table; emit it on every `CREATE TABLE`.

### 2. `CHECK` constraints for enum-shaped columns

Every column whose value is drawn from a closed set gets a `CHECK (col IN (...))`. Already encoded on: `images.format`, `images.nsfw`, `run_history.status`, `run_history.stop_reason`, plus `enabled IN (0,1)` on boolean-style integers. Pattern: when adding a new enum-shaped column, add the CHECK in the same migration.

### 3. `json_valid()` CHECK on every JSON text column

Refuses malformed JSON at write time so reads are always safe to `json_extract`. Already encoded on: `images.tags_source`, `subscriptions.input_params`, `source_credentials.payload`, `devices.filter_criteria`, `device_adds`, `input_params_snapshot`.

### 4. Drizzle `customType` for typed JSON columns

One helper, defined once in `db/schema.ts`:

```ts
import { customType } from 'drizzle-orm/sqlite-core'

export const jsonCol = <T>() => customType<{ data: T; driverData: string }>({
  dataType: () => 'text',
  toDriver: (v) => JSON.stringify(v),
  fromDriver: (v) => JSON.parse(v) as T,
})
```

Services declare typed JSON columns once and read/write them as native objects — never call `JSON.parse` / `JSON.stringify` in service code.

### 5. `COLLATE NOCASE` on tag- and slug-shaped text

Applied to `image_user_tags.tag`, `images.source_slug`, `subscriptions.source_slug`, `source_credentials.source_slug`, `devices.slug`. Indexes honor the collation, so `WHERE slug = 'Phone-Pixel'` matches `phone-pixel` and uses the index.

### 6. Explicit `ON DELETE` per foreign key

| FK | Action | Why |
|----|--------|-----|
| `device_subscriptions.device_id → devices(id)` | `CASCADE` | device hard-delete drops its joins |
| `device_subscriptions.subscription_id → subscriptions(id)` | `NO ACTION` | sub is soft-deleted, never hard |
| `device_images.device_id → devices(id)` | `CASCADE` | same as above |
| `device_images.image_id → images(id)` | `NO ACTION` | images soft-deleted |
| `image_user_tags.image_id → images(id)` | `NO ACTION` | |
| `favorites.image_id → images(id)` | `NO ACTION` | |
| `run_history.subscription_id → subscriptions(id)` | `NO ACTION` | sub soft-deleted |

### 7. `GENERATED VIRTUAL` columns for derived values

In schema today:

- `images.aspect_ratio REAL GENERATED ALWAYS AS (CAST(width AS REAL) / height) VIRTUAL` — usable directly in filter queries (`WHERE aspect_ratio BETWEEN 1.7 AND 1.8`). No app-side denormalization.
- `run_history.duration_ms INTEGER GENERATED ALWAYS AS (ended_at - started_at) VIRTUAL` — NULL while running (ended_at is NULL → arithmetic yields NULL).

If a future column needs to be both computed AND indexed-on-disk, use `STORED` instead of `VIRTUAL`. Default to `VIRTUAL` to save storage.

### 8. Upsert + `RETURNING *` as the standard pattern

Use `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING *` for any write that may collide with an existing row. Concrete sites:

- `source_credentials` save (insert-or-update on `source_slug`).
- Image ingest: `INSERT INTO images ... ON CONFLICT(source_url) DO UPDATE SET deleted_at = NULL RETURNING *` (handles soft-delete resurrection in one round trip).
- `device_images` fan-out: `INSERT OR IGNORE INTO device_images ...` (use `OR IGNORE` rather than upsert when the existing row should not be touched).

Drizzle supports `.onConflictDoUpdate({...})` and `.returning()` in `insert()` builders.

### 9. UNIQUE + NULL semantics

SQLite treats `NULL` as distinct in UNIQUE indexes — `(a, NULL)` and `(a, NULL)` both fit. None of the current UNIQUE columns are nullable, so this is informational. If a UNIQUE column ever goes nullable, add a partial unique index instead:

```sql
CREATE UNIQUE INDEX idx_uniq_when_present ON t(col) WHERE col IS NOT NULL;
```

### 10. Transactions at the service layer

Multi-write operations wrap in `db.transaction(tx => { ... })`. Concrete sites:

- Image ingest of one item: row insert + thumbnail registration + fan-out inserts.
- Subscription delete-with-images: soft-delete sub + delete `device_images` + delete `images` on-disk.

Drizzle exposes `db.transaction()`; deadlock-free in single-writer SQLite (WAL).

### 11. Naming conventions

- snake_case column names.
- `*_at` for timestamps (ms epoch).
- `*_ms` for durations.
- `*_id` for foreign keys.
- Plain `enabled` / `deleted_at` for booleans/flags (no `is_` prefix).
- JSON columns have no `_json` suffix — content is implied by the customType.

## First migration: `0000_pragma.sql`

```sql
PRAGMA journal_mode = WAL;          -- persisted on the DB file
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -64000;         -- 64 MB
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;       -- 256 MB
```

Most PRAGMAs are session-level; `client.ts` re-applies them on every connection open. `journal_mode=WAL` persists in the DB file once set.

## Source contract (TypeScript)

```ts
// src/lib/server/sources/_types.ts
import type { z } from 'zod'

export type Nsfw = 'sfw' | 'nsfw' | 'unknown'
export type Format = 'jpg' | 'png' | 'webp' | 'avif'

export type SourceItem = {
  source_id: string
  title: string
  source_url: string
  image_url: string
  filename: string                  // globally unique per source item
  width?: number
  height?: number
  file_size?: number
  format?: Format
  tags: string[]
  nsfw: Nsfw
  created_at_source?: string        // ISO 8601
  search_text?: string
}

export type SourceContext = {
  log: (level: 'debug'|'info'|'warn'|'error', msg: string, kv?: Record<string, unknown>) => void
  http_get_json: (url: string, init?: RequestInit) => Promise<unknown>
  http_get_bytes: (url: string, init?: RequestInit) => Promise<Uint8Array>
  abort: AbortSignal                // shutdown / cancel
}

export type SourceModule<Params = unknown, Credential = unknown> = {
  slug: string                                 // unique, kebab-case
  display_name: string
  params_schema: z.ZodType<Params>             // single source-of-truth
  credential?: {
    schema: z.ZodType<Credential>
    description: string                        // "Reddit OAuth client_id+secret", etc.
  }
  fetch: (
    ctx: SourceContext,
    params: Params,
    credential?: Credential,
  ) => AsyncGenerator<SourceItem, void, void>
}
```

The registry (`_registry.ts`) collects all modules and exposes:

```ts
export const sources: Record<string, SourceModule> = { reddit, danbooru, ... }
export function get_source(slug: string): SourceModule | undefined
export function source_json_schema(slug: string): JSONSchema  // via z.toJSONSchema(...) — only for external client introspection
```

## Ingest pipeline (one subscription run)

1. **Scheduler tick** decides subscription `S` fires now → `queue.enqueue(S.source_slug, () => executor.execute(S))`.
2. **Queue worker** for `S.source_slug` awaits any in-flight run, then starts.
3. **`executor.execute(S)`**:
   1. `service/run.start(S)` → insert `run_history` row, `status=running`, snapshot `input_params`.
   2. Resolve `source = sources[S.source_slug]`. If missing → fail run with `error='source_not_found'`.
   3. Load `source_credentials[S.source_slug]` if `source.credential` is declared.
   4. Build `SourceContext` (logger bound to run id, http with abort signal, AbortController).
   5. **Iterate**:
      - For each `item = yield from source.fetch(ctx, params, cred)`:
        - `items_seen += 1`.
        - If `items_seen > effective_max_items_inspected` → break, `stop_reason='max_items_inspected'`.
        - **Existing row check** (by `source_url`):
          - `blacklisted_at != null` → skip (no download, no fan-out).
          - `deleted_at != null` → treat as new ingest path; clear `deleted_at` after success.
          - Otherwise → call `fanout.backfill(existing, S)` (link to any newly-qualifying device dirs that don't have it). No download.
        - **Otherwise (new `source_url`)**:
          - Download bytes (via `ctx.http_get_bytes`). On error → `items_failed_download += 1`, continue.
          - Compute SHA256. Check `images.sha256`:
            - If row exists with same SHA256 (different `source_url`) → we have the bytes on disk already via that other row's device-image links. Use that file as the hardlink source for fan-out under the **new** image row (insert new `images` row, but point file paths at the existing on-disk file). One image row per `source_url`, multiple rows can share the same SHA256 + same on-disk bytes.
            - Else → write bytes to `<base-dir>/.staging/<uuid>`, then probe with sharp for true width/height/format.
          - Insert `images` row.
          - `service/thumbnail.generate(bytes)` → `<base-dir>/.thumbs/<image-uuid>.webp`.
          - `fanout.evaluate_and_link(image, S)`:
            - List enabled, non-deleted devices in `device_subscriptions` for `S.id`.
            - For each, run `filter.evaluate(image, device.filter_criteria)`.
            - For each pass, hardlink (fallback copy) from the chosen source path into `<base-dir>/<device-slug>/<source-slug>-<filename>.<ext>`. Insert `device_images` row.
            - Update `device_adds` accumulator.
          - `items_new += 1`.
   6. **Finalize** (`service/run.finalize`):
      - On uncaught throw → `status=failed`, `error=<message>`, `stop_reason='error'`.
      - On normal exit → `status=success`, `stop_reason=<set above or 'source_exhausted'>`.
      - Set `ended_at`, counters, `device_adds`.
      - Prune: `DELETE FROM run_history WHERE subscription_id = ? AND id NOT IN (SELECT id FROM run_history WHERE subscription_id = ? ORDER BY started_at DESC LIMIT 100)`.
4. Queue lock releases. Worker picks next pending run for the same source.

## Scheduler

```ts
// scheduler/cron.ts
const registry = new Map<subscription_id, Cron>()  // croner instances, schedule-only

// on bootstrap and on any subscription mutation:
//   - clear/recreate Cron for each enabled, non-deleted subscription
//   - Cron object owns next-fire computation; we tick at 60s and consult nextRun()

// scheduler/queue.ts
const chains = new Map<source_slug, Promise<void>>()
export function enqueue(source_slug, work): Promise<void> {
  const prev = chains.get(source_slug) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(work)
  chains.set(source_slug, next)
  return next
}
```

- Tick interval: every 60s, walk `registry`, for each subscription whose `nextRun() ≤ now`, enqueue. Update internal "last fired" so we don't re-enqueue mid-minute.
- Concurrency: parallel across `source_slug`s, serial within. Matches scope.
- Shutdown: signal handler aborts all in-flight `SourceContext.abort` controllers, awaits chains with grace timeout, exits.

## HTTP routing

- All `+page.server.ts` server loaders **call services directly** (no fetch-to-self).
- All `+server.ts` API handlers **call services directly**.
- Body/query validation: Zod schemas at the boundary; services trust their inputs.
- `hooks.server.ts`:
  - Wraps every request in a telemetry span.
  - **If `WALLRUS_AUTH_ENABLE=false`**: skip the entire auth gate. `/auth/login` GET returns 404 (or redirects to `/`); `/api/v1/auth/login` POST returns `410 Gone` with body `{ error: "auth_disabled" }`. All other routes pass through.
  - **Else (auth enabled)**:
    - `/api/v1/auth/login` → unauthenticated.
    - `/api/v1/*` (everything else) → accept any of: Bearer JWT / Basic / `auth_session` cookie. 401 otherwise.
    - `/auth/login` (HTML form) → unauthenticated; POST validates credentials → sets cookie.
    - `/auth/logout` → clears cookie.
    - Everything else under `/` → require `auth_session` cookie; redirect to `/auth/login` if missing.
- Static assets: served by SvelteKit/Vite as usual; auth applies to pages, not to `_app/immutable/*`.

### Auth flow

```
Env (toggle):
  WALLRUS_AUTH_ENABLE=true                      # default true. "false" -> skip all auth.

Env (REQUIRED when WALLRUS_AUTH_ENABLE=true):
  WALLRUS_USERNAME=<string>
  WALLRUS_PASSWORD=<string>
  WALLRUS_AUTH_SECRET=<32+ random bytes, hex>   # explicit. NO auto-derive. Missing -> crash at bootstrap.

Env (optional):
  WALLRUS_JWT_TTL_DAYS=30                       # default 30
  WALLRUS_TRUST_PROXY=false                     # default false


> **`WALLRUS_AUTH_ENABLE=false` behavior**: all routes public, no login page, no cookie check, no JWT verify, no Basic check. `WALLRUS_USERNAME`/`WALLRUS_PASSWORD`/`WALLRUS_AUTH_SECRET` are optional and silently ignored if set. Daemon emits a single startup warning log line so the choice is visible. Intended for deployments behind Authelia / Tailscale / OIDC proxy.

> **Bootstrap fail-fast (auth enabled)**: if `WALLRUS_AUTH_ENABLE=true` (default), all three of `WALLRUS_USERNAME` / `WALLRUS_PASSWORD` / `WALLRUS_AUTH_SECRET` are REQUIRED. Missing or empty → daemon refuses to start with a clear error pointing the user at how to generate the secret (`openssl rand -hex 32` or `bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"`). No silent auto-derivation — explicit secret prevents surprise session invalidation if the derivation inputs (machine_id, password) change across redeploys.


### WebUI (browser) — cookie path
  1. GET /                    → no cookie  → 302 /auth/login
  2. GET /auth/login          → HTML form (username, password)
  3. POST /auth/login         → server timing-safe compares against env
                              → on success: set cookie auth_session=<hmac-marker>,
                                 httpOnly, SameSite=Lax, Path=/, Max-Age=30d, Secure-when-https
                              → 302 /
  4. Subsequent GET/POST      → cookie carried; hooks.server.ts recomputes the marker and compares.
  5. POST /auth/logout        → cookie cleared.


### Mobile / API consumer — JWT path (primary)
  1. POST /api/v1/auth/login  {username, password}
                              → 200 {access_token, expires_at}
                              → app stores access_token (keychain)
  2. Subsequent calls          Authorization: Bearer <jwt>
                              → hooks.server.ts verifies signature + exp
  3. On 401 (expiry)           → app re-calls /api/v1/auth/login


### API consumer — Basic fallback
  GET /api/v1/images           Authorization: Basic base64("user:pass")
                              → timing-safe compared field-by-field against env
```

#### Shared secret

A single `auth_secret` (from `WALLRUS_AUTH_SECRET`) is the root for both cookie HMAC and JWT signing.

- **Must be provided explicitly via env**. No file fallback. No derivation. Missing → bootstrap fails (see above).
- Bootstrap validates length: minimum 32 bytes of entropy (64 hex chars / 44 base64 chars). Refuse shorter values.

Domain separation:
- Cookie HMAC: `HMAC-SHA256(auth_secret, "wallrus-cookie-v1:" + username + ":" + password)`.
- JWT signing key: `auth_secret` directly (HS256 via `jose`). Payload: `{ sub: "wallrus", iat, exp }`. No claims beyond standard.

Rotating `WALLRUS_AUTH_SECRET` (or username / password) invalidates every cookie and every previously-issued JWT in one shot.

#### Comparisons & hardening

- All credential comparisons use `crypto.timingSafeEqual` over equal-length buffers. Username and password compared separately so a length mismatch on one doesn't leak via the other.
- Rate limit: in-memory token bucket on `/auth/login`, `/api/v1/auth/login`, and on any 401 reply — ~5 attempts / minute / source IP. Resets on success. Pure in-memory; lost on restart, fine.
- HTTPS / proxy awareness:
  - `WALLRUS_TRUST_PROXY=true` flips Secure-cookie + proxy-IP logic on. Off by default (assumes direct listen).
  - When on, trust `X-Forwarded-Proto` and `X-Forwarded-For` from the first hop only.
  - Cookie `Secure` flag set when scheme is https (or trusted proxy says so).
- Telemetry redacts `Authorization`, `Cookie`, and POST bodies on `/auth/login` + `/api/v1/auth/login`.
- 401 responses are generic — no echo of submitted username/password.

### Listing & pagination contract

**All list endpoints** (gallery, devices, subscriptions, run history, etc.) share one pagination contract: a **cursor-hybrid** model that combines anchor cursors with offsets and returns a total count so the UI can render page numbers.

#### Query inputs

```ts
type ListQuery = {
  next?:   string   // UUIDv7 — anchor: results AFTER this row
  prev?:   string   // UUIDv7 — anchor: results BEFORE this row
  offset?: number   // default 0; additional rows to skip past the anchor
  limit?:  number   // default 60; capped at 200
  // filter params per endpoint (source, device, tag, q, ...)
}
```

- `next` and `prev` are **mutually exclusive**. If both are present, **`next` wins**.
- `next` / `prev` carry a single ID; the server uses the row's sort-key column AND its `id` to seek. Direction reverses for `prev`.
- `offset` is layered on top of the anchor (rare but useful for jump-to-page).
- **Page 1 is always cursor-less** (no `next`, no `prev`, `offset=0`). The UI must rebuild page 1 fresh — no stale anchor.

#### Response shape

```ts
type ListResponse<T> = {
  items:        T[]                       // up to `limit` items, in sort order
  total:        number                    // total row count under the current filter
  next_cursor?: string                    // id of last item in `items`, for "→" link
  prev_cursor?: string                    // id of first item in `items`, for "←" link
}
```

- `total` is a separate `COUNT(*)` query honoring the same filter. Cached briefly per filter signature if measurable; otherwise recomputed per request (fine at MVP scale).
- `next_cursor` / `prev_cursor` are present whenever a corresponding direction has more rows.

#### Deterministic ordering

**Mandatory invariant**: every list query MUST end with `, id ASC` (or `, id DESC` to match direction) as the final tie-breaker. UUIDv7 is sortable, so `(primary_sort_col, id)` gives a stable, total order that survives mutations during paging.

For most endpoints the primary sort is `(<created_at_or_ingested_at> DESC, id DESC)`. For the gallery: `(ingested_at DESC, id DESC)`. Filter changes reset to page 1.

#### Direction-aware SQL pattern

```sql
-- forward (next)
SELECT ... FROM images
WHERE <filter>
  AND (ingested_at, id) < (SELECT ingested_at, id FROM images WHERE id = ?)
ORDER BY ingested_at DESC, id DESC
LIMIT ? OFFSET ?

-- backward (prev): same predicate flipped, ORDER ASC, then reverse the slice in service
SELECT ... FROM images
WHERE <filter>
  AND (ingested_at, id) > (SELECT ingested_at, id FROM images WHERE id = ?)
ORDER BY ingested_at ASC, id ASC
LIMIT ? OFFSET ?
-- service then re-reverses the array before returning

-- page 1 (no cursor)
SELECT ... FROM images
WHERE <filter>
ORDER BY ingested_at DESC, id DESC
LIMIT ? OFFSET ?
```

`(col, id) < (val, anchor_id)` is the row-value-comparison form SQLite supports for compound cursor seeks.

#### UI semantics — `page` is transient

The UI tracks the current page number as a **transient query param** (`?page=4`). The system does **not** know what page the user is on; `page` is purely an aid for rendering "Page X of Y" labels and pagination buttons.

- Page 1: URL omits `next` / `prev` (and may omit `page` or set `page=1`).
- Next click: pushes `?page={current+1}&next={items[last].id}`.
- Prev click: pushes `?page={current-1}&prev={items[0].id}`. If landing back on page 1, drop the cursor.
- Jump-to-page-N from a non-adjacent state: use pure `offset = (N-1) * limit` (no cursor). Honest stale-tolerant behavior — collection may have shifted, the user sees the current top-(N-1)*limit window.
- Stale `page` is acceptable: if the underlying collection grew, `?page=4&next=<old-id>` simply renders whatever follows that anchor — the page number label may be off by some rows but no error.

#### Service helpers

```ts
// src/lib/server/service/_pagination.ts
export type Cursor = { next?: string; prev?: string; offset?: number; limit?: number }
export type Page<T> = { items: T[]; total: number; next_cursor?: string; prev_cursor?: string }

export function paginate<T>(/* query builder, cursor, sort spec */): Promise<Page<T>>
```

All listing services compose this helper; per-endpoint code stays focused on the filter clauses.

## Frontend

The WebUI is a SvelteKit app served from the same Bun process as the API. Server `load()` functions and form actions call services directly (no fetch-to-self).

### Stack

| Concern | Pick |
|---------|------|
| Framework | **Svelte 5** (runes: `$state`, `$derived`, `$effect`) + SvelteKit |
| Styling | **Tailwind CSS v4** (CSS-first config, oxide engine) |
| UI primitives | **shadcn-svelte** (Bits UI under the hood) — components live in `src/lib/components/ui/` as copy-paste source |
| Icons | **lucide-svelte** |
| Form validation | **Zod** (same schemas as the API) + form actions returning `fail()` with field-level errors |
| Real-time | **Server-Sent Events** (`/api/v1/runs/stream`) for live run progress |
| Data fetching | SvelteKit `load()` + `invalidate*()` (no tanstack-query) |

### Component organization

```
src/lib/
  components/
    ui/                         # shadcn-svelte primitives: button, input, dialog, dropdown, sheet, ...
    gallery/
      ImageGrid.svelte          # virtualized grid (IntersectionObserver-driven)
      ImageCard.svelte          # thumbnail tile, NSFW blur, favorite/menu overlay
      ImageDetail.svelte        # modal or full page for one image
      FilterBar.svelte          # chips + inputs that drive the URL query string
    forms/
      ZodForm.svelte            # generic zod-driven form (walks schema → renders fields)
      Field.svelte              # one input + label + error slot
    devices/
      DeviceCard.svelte
      FilterEditor.svelte       # editor for filter_criteria JSON
    subscriptions/
      SubscriptionForm.svelte   # wraps ZodForm with the selected source's params_schema
      SourcePicker.svelte
    runs/
      RunRow.svelte
      Dashboard.svelte          # SSE-driven counters + sparkline
    nav/
      TopBar.svelte
      ThemeToggle.svelte
      NsfwToggle.svelte
  stores/                       # only when state must cross routes
    theme.ts                    # dark/light, localStorage-backed
    nsfw.ts                     # reveal toggle, localStorage-backed
  client/                       # browser-only utilities
    sse.ts                      # typed EventSource wrapper
    fetcher.ts                  # fetch wrapper for /api/v1/*
```

### State management

- **Server state** → SvelteKit `load()` returns + `invalidate('app:images')` / `invalidateAll()` after mutations. No tanstack-query.
- **Local UI state** → `$state` runes inline. Stores only when shared across routes.
- **Persisted client state** (theme, NSFW reveal, gallery density) → tiny store wrappers around `localStorage`.

### Gallery rendering

**Layout: aspect-aware masonry (Pinterest-style with column-spanning landscape cards).** Variable image heights packed into responsive columns; landscape images occupy 2 columns, portrait images occupy 1. No cropping. Pure CSS Grid implementation — **no JS-positioned masonry library** in MVP.

#### Breakpoint contract

| Viewport | Columns | Landscape (`aspect_ratio > 1.2`) | Portrait / squareish |
|----------|---------|----------------------------------|----------------------|
| Mobile (`< 640px`) | 2 | span 2 (fills width) | span 1 |
| Tablet (`640–1023px`) | 3 | span 2 | span 1 |
| Desktop (`≥ 1024px`) | 4 | span 2 | span 1 |

Inter-card gap is tight on mobile (e.g. 2 px) and grows slightly on larger viewports.

#### Implementation

- Single CSS Grid with `grid-template-columns: repeat(var(--cols), 1fr)` and `grid-auto-rows: <base-unit>` (small, e.g. 8 px).
- Per-card style is computed once at render time from `images.width` / `images.height`:
  - `grid-column: span 1 | 2` from aspect ratio + breakpoint rule.
  - `grid-row: span N` where `N = round(rendered_card_height / base-unit)` — `rendered_card_height` is derived from the card's actual rendered column width × image aspect ratio.
- **`grid-auto-flow: dense`** — CSS Grid greedy-packs items into the earliest fitting slot, filling gaps left by 2-col landscape items. Handles rebalancing **for free**.
- Breakpoint changes adjust `--cols`; the grid recomputes layout natively without JS reflow.

> **Source-order vs visual-order trade-off**: `grid-auto-flow: dense` may reorder cards visually relative to DOM order to fill gaps. DOM order remains the cursor order from DB (deterministic), so screen readers and Tab navigation still walk the data sequence. Visual reflow is a known cost of `dense` masonry — acceptable here because (a) wallpaper gallery is a visual-first surface, (b) sequential reading is not the primary task.

#### Per-card markup

```svelte
<a
  href="/images/{img.id}"
  class="card"
  data-nsfw={img.nsfw}
  style="
    grid-column: span {span_for(img.aspect_ratio)};
    grid-row: span {row_span_for(img, current_col_width)};
    content-visibility: auto;
    contain-intrinsic-size: {col_w}px {est_h}px;
  "
>
  <img
    src="/api/v1/images/{img.id}/thumbnail"
    alt={img.title || 'untitled'}
    width={img.width}
    height={img.height}
    loading="lazy"
    decoding="async"
  />
</a>
```

`content-visibility: auto` + `contain-intrinsic-size` lets the browser skip paint/layout of off-screen cards natively, replacing manual virtualization.

#### Pagination — no infinite scroll

Page-based. The page-control UI lives at the bottom of the gallery (and optionally a sticky control on the top bar). See *Listing & pagination contract* below for the wire format.

#### Density toggle

Top-bar control toggles **compact / comfortable / spacious**, which adjusts:
- `--cols` increment for each breakpoint (e.g. desktop comfortable=4, compact=5, spacious=3).
- Gap size.

Persisted in `localStorage`.

#### When to swap for a library

If the `dense` reflow becomes visually unacceptable (large gaps, awkward reorderings) at scale, swap the gallery component for `svelte-bricks` (JS-positioned masonry) or roll a custom packer. **The schema, API, and pagination contract do not change** — only the view component.

### Image detail flow

- **Card click** in the gallery → navigate to `/images/[id]` (full SvelteKit page, not modal). Detail page shows the original-sized image (`/api/v1/images/[id]/original`) plus metadata: title, source link, source tags, user tags, devices that have it, ingestion date, dimensions, file size, format, NSFW state.
- **Image click in detail page** → opens the raw image (`/api/v1/images/[id]/original`) in a new tab (`target="_blank" rel="noopener"`). Lets the user save / view / drag-out at native resolution.

### Image loading

- Card uses thumbnail URL (`/api/v1/images/[id]/thumbnail` → `<base-dir>/.thumbs/<uuid>.webp`).
- `<img loading="lazy" decoding="async" width height>` — browser reserves layout space; no CLS.
- Detail view fetches the original via `/api/v1/images/[id]/original`.
- No client-side resize / canvas trickery.

### NSFW UX

- Card receives `data-nsfw="sfw" | "nsfw" | "unknown"`.
- Global `nsfw_reveal` store reads `localStorage.wallrus.nsfw_reveal` (default `false`).
- CSS rule: `.card[data-nsfw="nsfw"]:not(.revealed) img { filter: blur(20px); }`.
- Top-bar toggle flips the global state. Per-card click-to-reveal also flips the card's `.revealed` class.

### Forms (Zod-driven)

- `ZodForm.svelte` walks a Zod schema and emits one `Field` per leaf:
  - `z.string()` → `<Input type="text">`
  - `z.number()` → `<Input type="number">`
  - `z.enum([...])` → `<Select>`
  - `z.array(z.string())` → `<TagInput>`
  - `z.boolean()` → `<Switch>`
- Server form actions validate using the same schema; failure returns `fail(400, { errors })` keyed by field path. `ZodForm` renders errors next to each field.
- Subscription form delegates straight to `ZodForm` using the picked source's `params_schema`.

### Live run progress (SSE)

- Endpoint: `GET /api/v1/runs/stream` returns `text/event-stream`. Auth same as other API routes (Bearer / Basic / cookie).
- Event types:
  - `run.started`  `{ id, subscription_id, source_slug, started_at }`
  - `run.progress` `{ id, items_seen, items_new }` — throttled to ~1/sec per active run
  - `run.finished` `{ id, status, stop_reason, items_seen, items_new, items_failed_download, device_adds, duration_ms }`
- Client: `EventSource` wrapper in `lib/client/sse.ts`, auto-reconnects on close. Dashboard subscribes once per session; appends/updates rows live.

### Theming

**Archetype: dark-first minimal + glass chrome.** Wallpapers are the hero. Gallery itself stays borderless and minimal so it doesn't compete with image content; glass effects (`backdrop-filter: blur(20px) saturate(180%)`) are reserved for chrome surfaces that float over the gallery — top bar, dialogs, sheets/drawers, popovers, tooltips, dropdown menus, command palette. Solid surfaces everywhere else.

- `:root[data-theme="dark|light"]` toggled at layout mount from `localStorage` → `prefers-color-scheme` fallback. Default theme = `dark`.
- shadcn-svelte tokens drive both themes via CSS variables.
- Toggle in top bar persists choice.
- **Accent**: violet `#7c5cff`. Used sparingly on focus rings + status pills + active nav indicator. One hue only — do not introduce a second accent without explicit confirmation.

### Design tokens (dark)

```css
:root[data-theme="dark"] {
  --bg:           #0a0a0c;                      /* near-black, slight cool */
  --bg-elev:      #131316;
  --surface:      rgb(255 255 255 / 0.04);      /* card bg */
  --surface-hi:   rgb(255 255 255 / 0.08);      /* hover */
  --glass:        rgb(20 20 24 / 0.55);         /* nav, modals, popovers */
  --glass-border: rgb(255 255 255 / 0.08);
  --fg:           #e8e8ec;
  --fg-muted:     #9a9aa3;
  --accent:       #7c5cff;                       /* violet */
  --accent-fg:    #f3f0ff;
  --ring:         rgb(124 92 255 / 0.4);
  --radius:       10px;
  --radius-card:  12px;
  --blur:         20px;
}
```

Light-mode tokens flip surfaces and glass to white-translucent equivalents; accent stays `#7c5cff`.

### Glass usage rules

- Only on chrome surfaces (top bar, `Dialog`, `Sheet/Drawer`, `Popover`, `Tooltip`, `DropdownMenu`, `CommandPalette`).
- Never on gallery cards or image content backgrounds — would cost perf with many cards and would fight image content visually.
- When glass is over the gallery, pair with a thin `--glass-border` so the edge is legible against varied wallpapers.
- Honor `prefers-reduced-transparency` — fall back to solid `--bg-elev` when set.

### Typography

- Body / UI: **Inter** (variable). Self-hosted, no Google Fonts fetch.
- Mono / numeric (run counters, hashes, IDs): **Geist Mono** or **JetBrains Mono**.
- No more than two font families ship.

### Accessibility baseline

- All interactive elements keyboard-reachable (shadcn-svelte / Bits UI handles focus management).
- Image cards: `alt={title || "untitled"}`.
- NSFW reveal: explicit click/tap + keyboard handler (no hover-only).
- Color contrast ≥ AA on both themes.
- `prefers-reduced-motion` respected for non-essential transitions.

### Build / caching

- SvelteKit immutable bundle hashing via `_app/immutable/*` (adapter sets long cache headers).
- Static assets in `static/` for favicon + logo.
- No service worker in MVP.

## FS layout (runtime)

```
<base-dir>/                                 chmod 700
  wallrus.db                                chmod 600
  wallrus.db-wal
  wallrus.db-shm
  .thumbs/<image-uuid>.webp                 one per image
  .staging/<uuid>                           temp files during download; renamed/linked on success
  <device-slug>/<source-slug>-<filename>.<ext>   hardlinked or copied
```

`fs/perms.ts` runs at bootstrap. If the data dir or DB file is world/group-readable, the daemon refuses to start (with a clear error pointing at `chmod 700 / chmod 600`).

`fs/link.ts`:

```ts
async function link_or_copy(src: string, dst: string) {
  try {
    await fs.link(src, dst)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(src, dst)
      return
    }
    throw e
  }
}
```

## Bootstrap sequence (`serve`)

```
1. parse env via Zod → typed config singleton
   (WALLRUS_DATA_DIR,
    WALLRUS_AUTH_ENABLE (default true),
    WALLRUS_USERNAME, WALLRUS_PASSWORD, WALLRUS_AUTH_SECRET,    # required when WALLRUS_AUTH_ENABLE=true
    WALLRUS_JWT_TTL_DAYS?, WALLRUS_TRUST_PROXY?,
    WALLRUS_LISTEN_ADDR,
    WALLRUS_OTEL_ENDPOINT?)
   # Zod schema enforces:
   #   - if WALLRUS_AUTH_ENABLE=true (default), require USERNAME + PASSWORD + AUTH_SECRET
   #     (and AUTH_SECRET >= 32 bytes of entropy). Reject otherwise.
   #   - if WALLRUS_AUTH_ENABLE=false, all three are optional and ignored. Emit a single
   #     startup warning so the choice is visible in logs.
2. init telemetry (pretty if TTY, JSON otherwise, OTEL if endpoint set)
3. fs/perms: ensure data dir exists; chmod 700; refuse if too open
4. db/client: open bun:sqlite via Drizzle, apply session PRAGMAs
5. db/migrate: run pending migrations
6. fs/perms: chmod 600 on db file post-migration
7. crash-recovery: UPDATE run_history SET status='failed', stop_reason='daemon_crash' WHERE status='running'
8. scheduler/cron: load subscriptions, build registry, start 60s tick
9. start Bun.serve with SvelteKit handler
10. install signal handlers (SIGTERM/SIGINT): abort scheduler signals, drain HTTP, close DB, exit
```

## Telemetry wiring

- `telemetry.ts` configures `@tigorhutasuhut/telemetry-js` once at bootstrap.
- Service modules receive a bound logger via a thin DI helper (or via module import — keep it simple).
- Per-request span in `hooks.server.ts`.
- Per-run span around `executor.execute`.
- Counters: per-source items_seen / items_new, per-subscription run counts. Gauges: scheduler pending depth per source.

## Authoring sources

Add a new source = a TypeScript file under `src/lib/server/sources/<slug>.ts` and one line in `_registry.ts`. Skeleton:

```ts
// reddit.ts (sketch)
import { z } from 'zod'
import type { SourceModule, SourceItem } from './_types'

const Params = z.object({
  subreddit: z.string().min(1),
  sort: z.enum(['hot', 'new', 'top']).default('hot'),
  time: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('all'),
})

const reddit: SourceModule<z.infer<typeof Params>> = {
  slug: 'reddit',
  display_name: 'Reddit',
  params_schema: Params,
  async *fetch(ctx, params) {
    let after: string | undefined
    while (!ctx.abort.aborted) {
      const url = `https://www.reddit.com/r/${params.subreddit}/${params.sort}.json` +
                  `?limit=100${after ? `&after=${after}` : ''}` +
                  `${params.sort === 'top' ? `&t=${params.time}` : ''}`
      const data: any = await ctx.http_get_json(url)
      if (!data?.data?.children?.length) return
      for (const { data: post } of data.data.children) {
        if (!post.url || !looks_like_image(post.url)) continue
        const item: SourceItem = {
          source_id: post.id,
          title: post.title ?? '',
          source_url: `https://reddit.com${post.permalink}`,
          image_url: post.url,
          filename: post.id,
          tags: [],
          nsfw: post.over_18 ? 'nsfw' : 'sfw',
          created_at_source: new Date(post.created_utc * 1000).toISOString(),
          search_text: [post.title, post.author, `r/${params.subreddit}`].filter(Boolean).join(' '),
        }
        yield item
      }
      after = data.data.after
      if (!after) return
    }
  },
}

export default reddit
```

## Deferred (in scope, not built in MVP)

- CLI subcommands beyond `serve` (per your call). Unix domain socket admin endpoint also deferred.
- Run-once is exposed via `POST /api/v1/runs/run-now` only.
- OS-sandbox hooks (`bwrap`/`sandbox-exec`) — N/A since sources are first-party.

## Out of architecture scope (post-MVP)

- Collections (DB-only feature; new tables + service + UI/API surface when built).
- Mobile/native app (consumes existing API).
- More first-party sources.
- Perceptual-hash dedup.
- Pluggable storage backends.
- Trigram-tokenizer FTS5 over `title` / `source_url`.
- Third-party source extensibility: would require selecting a sandbox model (subprocess + IPC + separate OS user, or `bwrap`/`sandbox-exec` wrapper). Not committed.
