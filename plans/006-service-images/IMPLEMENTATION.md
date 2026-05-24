# 006 — Service: images

## Status

**in-progress**

## Goal

`images` domain end-to-end: services, schemas, REST endpoints, including
FTS5 search over `search_text`. Covers list/get/favorite/tag/delete/
blacklist/restore + per-device fan-out queries. No ingest yet (that's
009); this slice operates against rows seeded by tests.

## Decisions (pre-baked)

- **Operations**:
  - `ListImages` — paginated, filters `{ device_id?, source_slug?,
favorited?, nsfw?, include_deleted?, include_blacklisted?, search? }`.
  - `GetImage` — by id (404 if soft-deleted unless `include_deleted=true`).
  - `ListDeviceImages` — convenience: images in a device's dir
    (joins `device_images`). Same paginated shape.
  - `ToggleFavorite` — body `{ favorited: boolean }`.
  - `AddTag` — body `{ tag: string }` inserts into `image_user_tags`.
  - `RemoveTag`.
  - `SoftDeleteImage` — sets `deleted_at`. Does NOT remove files in this
    slice (file removal happens via ingest pipeline in 009; this slice
    is DB-only). Add a TODO comment referencing 009.
  - `BlacklistImage` — sets `blacklisted_at`.
  - `RestoreImage` — clears `deleted_at` (only — not `blacklisted_at`).
- **Pagination**: same contract as 004/005.
- **Search**: when `search` query is supplied, join against
  `search_text_fts` virtual table (`MATCH ?`), with `bm25(search_text_fts)`
  ordering. Without search, order by `created_at DESC, id DESC`.
- **NSFW filter**: `all` (no filter), `sfw_only` (nsfw = 'safe' OR 'unknown'?
  per scope: `all` includes Unknown, `sfw_only` excludes Unknown). Match
  exactly: `sfw_only` → `nsfw = 'safe'`; `nsfw_only` → `nsfw = 'nsfw'`;
  `all` → no filter.
- **Tags input**: stored normalised lower-case in `image_user_tags`.
  Service lower-cases + trims; duplicates (UNIQUE constraint) return
  the existing row, not an error.
- **API shape**:
  - `GET /api/v1/images`
  - `GET /api/v1/images/[id]`
  - `GET /api/v1/devices/[slug]/images`
  - `POST /api/v1/images/[id]/favorite` body `{ favorited }`
  - `POST /api/v1/images/[id]/tags` body `{ tag }` (idempotent)
  - `DELETE /api/v1/images/[id]/tags/[tag]`
  - `DELETE /api/v1/images/[id]` (soft-delete; `?blacklist=true` →
    blacklist instead)
  - `POST /api/v1/images/[id]/restore`

## State at end of slice

- `src/lib/server/service/images/*` mixin set
- `src/lib/schemas/images/*` Zod schemas
- Routes wired
- Service tests assert FTS5 search returns ordered hits

## Resume here

1. Read `.claude/rules/service.md`, `.claude/rules/api.md`,
   `engineering/ARCHITECTURE.md` §FTS5 and §Image lifecycle.
2. Schemas: DTO + per-operation request/response.
3. Services: mixin set per Decisions. `ListImages` builds the SQL via
   Drizzle's query builder + a raw FTS join when `search` is supplied.
   Use `withQueryName("images.list")` etc.
4. Routes: 8 endpoints. `DELETE /api/v1/images/[id]?blacklist=true`
   parses the query param into the schema before dispatch.
5. Tests:
   - Seed DB helper inserts 20 image rows across 2 devices, 2 sources,
     mixed nsfw.
   - Cover every filter combo.
   - FTS5 test: insert two images with `search_text` `cat on a roof`
     vs `dog in the park`, query `cat` returns first only.
   - Tag idempotency: same `AddTag` twice returns same row, no error.
6. Smoke: list → search → favorite → tag → soft-delete → restore.
7. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green (FTS5 path explicitly tested)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke per step 6
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(service-images): list/search/get/favorite/tag/delete/blacklist/restore + per-device images
```

Body: ops list, FTS5 search join, NSFW filter mapping, tag idempotency,
soft-delete vs blacklist semantics, no-file-IO-this-slice note. Co-author.
Push. Then `chore(plans): mark 006-service-images done`.

## Gotchas

- The `search_text_fts` virtual table from 001 is keyed by
  `image.id`; the join uses `WHERE images.id IN (SELECT id FROM
search_text_fts WHERE search_text_fts MATCH ?)`. Don't `JOIN` —
  the rowid mapping makes IN-subquery cleaner.
- `bm25()` ranking is descending-by-score; remember `ORDER BY bm25
ASC` reads as "best first" because bm25 returns negative scores in
  SQLite's FTS5. Verify with the unit test, not memory.
- `RestoreImage` MUST refuse if `blacklisted_at IS NOT NULL`. That's a
  separate flow (unblacklist) which is post-MVP — surface an
  `AppError("validation.blacklisted", …)`.
- This slice does NOT touch disk. `SoftDeleteImage` only writes
  `deleted_at`. The next ingest run in 009 reconciles disk state.

## Deferred

- File removal on soft-delete / blacklist → 009-ingest-pipeline (the
  pipeline reconciles disk state per scope).
- Bulk operations → post-MVP.
- Cross-image hash dedup endpoint → post-MVP (perceptual hash).
