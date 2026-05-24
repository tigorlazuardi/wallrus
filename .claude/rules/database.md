---
paths:
  - "src/lib/server/db/**"
  - "drizzle/**"
  - "migrations/**"
  - "**/schema.ts"
  - "drizzle.config.*"
---

# wallrus — database & schema rules

Full schema sketch in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §DB schema. This rule restates the enforceable conventions.

## ORM and driver

- **Drizzle ORM** + `drizzle-kit` for migrations.
- Driver: `bun:sqlite` (Bun built-in). Never `better-sqlite3`.
- Schema lives at `src/lib/server/db/schema.ts`. Client setup at `src/lib/server/db/client.ts`. Migration runner at `src/lib/server/db/migrate.ts`.
- **Prefer Drizzle's ORM-style query API** (`db.query.images.findMany({ where, with, orderBy, limit })`) over the `.select()` query builder, except where the builder is the only way to express the SQL.

## Migration strategy

- Hand-written SQL in `drizzle/migrations/`, fed to `drizzle-kit`'s migrator.
- **First migration**: `0000_pragma.sql` sets PRAGMAs:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA cache_size = -64000;
  PRAGMA temp_store = MEMORY;
  PRAGMA mmap_size = 268435456;
  ```
- `journal_mode = WAL` persists on the file. Session-level PRAGMAs (foreign_keys, busy_timeout, etc.) are reapplied on every connection open by `client.ts`.
- Second migration onward: `0001_initial_schema.sql` and onward.
- Crash recovery sweep (mark `status='running'` rows as `failed` with `stop_reason='daemon_crash'`) runs at bootstrap, after migrations, **before** the scheduler tick starts.

## SQLite conventions (enforce on every new table or migration)

1. **`STRICT` on every CREATE TABLE.** Drizzle: `.strict()` per table.
2. **`CHECK (col IN (...))`** on every enum-shaped column. Examples already in schema: `format`, `nsfw`, `status`, `stop_reason`, `enabled IN (0,1)`.
3. **`CHECK (json_valid(col))`** on every JSON text column. Examples: `images.tags_source`, `subscriptions.input_params`, `source_credentials.payload`, `devices.filter_criteria`, `device_adds`, `input_params_snapshot`.
4. **Drizzle `customType` for typed JSON.** Define once in `db/schema.ts`:
   ```ts
   import { customType } from "drizzle-orm/sqlite-core"
   export const jsonCol = <T>() =>
     customType<{ data: T; driverData: string }>({
       dataType: () => "text",
       toDriver: (v) => JSON.stringify(v),
       fromDriver: (v) => JSON.parse(v) as T,
     })
   ```
   **Services and routes must NEVER call `JSON.parse` / `JSON.stringify` on DB-bound JSON columns.** Always go through the typed column.
5. **`COLLATE NOCASE` on tag- and slug-shaped text** columns: `image_user_tags.tag`, `images.source_slug`, `subscriptions.source_slug`, `source_credentials.source_slug`, `devices.slug`. Indexes honor the collation; case-insensitive equality + ordering for free.
6. **Explicit `ON DELETE` per FK** (no implicit defaults in migration SQL):
   | FK | Action |
   |----|--------|
   | `device_subscriptions.device_id → devices(id)` | `CASCADE` |
   | `device_subscriptions.subscription_id → subscriptions(id)` | `NO ACTION` |
   | `device_images.device_id → devices(id)` | `CASCADE` |
   | `device_images.image_id → images(id)` | `NO ACTION` |
   | `image_user_tags.image_id → images(id)` | `NO ACTION` |
   | `favorites.image_id → images(id)` | `NO ACTION` |
   | `run_history.subscription_id → subscriptions(id)` | `NO ACTION` |
7. **`GENERATED ... VIRTUAL`** for derived columns. Current:
   - `images.aspect_ratio REAL GENERATED ALWAYS AS (CAST(width AS REAL) / height) VIRTUAL`.
   - `run_history.duration_ms INTEGER GENERATED ALWAYS AS (ended_at - started_at) VIRTUAL` — NULL while running.
     Use `STORED` only when the column must be both computed AND indexed-on-disk.
8. **Upsert + `RETURNING *` as standard write pattern.** Drizzle exposes `.onConflictDoUpdate({...})` + `.returning()`. Use for `source_credentials` save, image ingest (resurrect from soft-delete), etc. Use `INSERT OR IGNORE` for write-once junction rows like `device_images` where the existing row should not be touched.
9. **UNIQUE + NULL gotcha**: SQLite treats `NULL` as distinct in UNIQUE indexes. If a UNIQUE column ever goes nullable, add `CREATE UNIQUE INDEX … WHERE col IS NOT NULL` instead.

## Primary keys: UUIDv7

- All tables use UUIDv7 strings as PKs.
- Library: `uuidv7` (tiny pkg).
- Time-sortable, B-tree friendly, mobile-sync friendly. Pagination cursors lean on this (see [`api.md`](./api.md)).

## Junction tables — always add a reverse composite index

For any junction `(a, b)` the PK covers lookups starting from `a`. **Always add a reverse composite index `(b, a)`** (non-unique) so lookups starting from `b` also use an index. Concrete reverses already declared:

```sql
CREATE INDEX idx_devsub_reverse ON device_subscriptions(subscription_id, device_id);
CREATE INDEX idx_devimg_reverse ON device_images(image_id, device_id);
CREATE INDEX idx_imgtag_reverse ON image_user_tags(tag, image_id);
```

When adding a new junction table, **also add its reverse composite in the same migration**.

## Indexes (current declarations)

```sql
CREATE INDEX idx_images_source_slug      ON images(source_slug);
CREATE INDEX idx_images_ingested_at      ON images(ingested_at);
CREATE INDEX idx_images_deleted_partial  ON images(id) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_images_blacklisted_partial ON images(id) WHERE blacklisted_at IS NOT NULL;

CREATE INDEX idx_subs_active             ON subscriptions(enabled, source_slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_subs_deleted_partial    ON subscriptions(id) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_runs_sub_started        ON run_history(subscription_id, started_at DESC);
CREATE INDEX idx_runs_status             ON run_history(status); -- crash-recovery sweep
```

## FTS5

```sql
CREATE VIRTUAL TABLE images_fts USING fts5(
  search_text,
  content='images',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
-- + insert/update/delete triggers to keep the mirror in sync.
```

Trigram tokenizer for substring search on `title` / `source_url` is **post-MVP**.

## Time convention (load-bearing)

- Every timestamp column is named `*_at` and stored as `INTEGER` **unix milliseconds since epoch**.
- Every duration column carries the suffix `_ms` and is stored as `INTEGER` (millisecond precision).
- **No `TEXT` ISO strings, no `REAL` seconds in the DB.**
- Read path: convert to `Date` or ISO at the API boundary (in routes / response shapers), not in services.
- Write path: services use `Date.now()` to populate `*_at`. Avoid DB-side `unixepoch('subsec') * 1000` defaults so a test clock can be injected at the service layer.
- `created_at_source` from sources arrives as ISO; convert with `Date.parse(...)` before insert.

## Soft-delete & blacklist semantics

- `images.deleted_at TIMESTAMP NULL` — soft-delete; file removed from every device dir, row stays. Crawler resurrects on re-encounter (clears `deleted_at`, re-downloads, re-fans-out).
- `images.blacklisted_at TIMESTAMP NULL` — permanent skip; file removed everywhere, row stays, future encounters of same `source_url` or `sha256` short-circuit before download.
- `subscriptions.deleted_at TIMESTAMP NULL` — soft-delete; row stays so `run_history.subscription_id` FK keeps resolving.
- **Hard prune is not a MVP feature.** Don't `DELETE FROM images …` anywhere.

## Transactions

- Multi-write operations wrap in `db.transaction(tx => { … })`. Concrete sites:
  - Image ingest of one item: insert `images` row + insert `device_images` rows + register thumbnail.
  - Subscription delete-with-images: soft-delete sub + delete `device_images` rows + soft-delete `images`.
- SQLite WAL = single writer; deadlocks are impossible in single-process operation.

## Naming conventions

- `snake_case` column names.
- `*_at` for timestamps (ms epoch).
- `*_ms` for durations.
- `*_id` for foreign keys.
- Plain `enabled` / `deleted_at` for booleans/flags (no `is_` prefix).
- JSON columns have no `_json` suffix — content is implied by the customType.

## Before changing the schema

- Confirm the change does not violate the conventions above.
- Generate a new numbered migration file under `drizzle/migrations/` — do not edit migrations that have already been applied to your dev DB or any deployed instance.
- For any new table: add `STRICT`, all relevant `CHECK`s, the appropriate FK `ON DELETE`, and (if it's a junction) the reverse composite index in the SAME migration.
