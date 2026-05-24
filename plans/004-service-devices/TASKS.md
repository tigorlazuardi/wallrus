# 004 — Service: devices — tasks

## Shared helpers

- [x] `src/lib/server/http/pagination.ts`: `parse_pagination`, `encode_cursor`, `decode_cursor`
- [x] Unit test: cursor encode/decode roundtrip
- [x] Unit test: malformed cursor returns null (no throw)
- [x] Unit test: `limit` clamped to `[1, 200]`, default 50
- [x] `src/lib/server/http/errors.ts`: `app_error_to_response`
- [x] Unit test: each known `AppError` code maps to expected status

## Schemas

- [x] `src/lib/schemas/devices/DeviceFilters.ts` — Zod object per Decisions
- [x] `src/lib/schemas/devices/Device.ts` — DTO
- [x] `src/lib/schemas/devices/{ListDevices,GetDevice,CreateDevice,UpdateDevice,DeleteDevice,ToggleDevice}.ts` request + response schemas
- [x] `src/lib/schemas/devices/index.ts` barrel
- [x] Unit test: `DeviceFilters` rejects unknown keys (strict)
- [x] Unit test: `CreateDeviceRequest.slug` regex `[a-z0-9-]{1,64}` enforced

## Service

- [x] `src/lib/server/service/devices/base.ts`
- [x] `ListDevices.ts` — paginated, `@traced`, `withQueryName("devices.list")`, deterministic `, id` tie-breaker
- [x] `GetDevice.ts` — by id or slug, throws `AppError("not_found.device", …)` if missing
- [x] `CreateDevice.ts` — Drizzle insert with `RETURNING *`, throws `AppError("validation.slug_taken", …)` on UNIQUE violation
- [x] `UpdateDevice.ts` — partial update; throws not_found if 0 rows
- [x] `DeleteDevice.ts` — hard delete
- [x] `ToggleDevice.ts` — sets enabled flag
- [x] `index.ts` barrel composing mixins into `DeviceService`
- [x] `runtime.ts` exposes `runtime.services.devices` (via bootstrap.ts — Runtime type + boot() updated; runtime.ts itself unchanged)

## Routes

- [x] `src/routes/api/v1/devices/+server.ts` — GET + POST
- [x] `src/routes/api/v1/devices/[slug]/+server.ts` — GET + PATCH + DELETE
- [x] `src/routes/api/v1/devices/[slug]/toggle/+server.ts` — POST
- [x] Each handler: Zod-parse → call service → return JSON, catch via `app_error_to_response`
- [x] All handlers use `request.json()` only for write bodies

## Service tests

- [x] In-memory DB helper: `src/test/db.ts` creates a fresh `:memory:` SQLite, runs migrations, returns a Drizzle handle
- [x] `ListDevices.test.ts` — empty, populated, pagination forward, pagination backward (`prev`), `enabled` filter
- [x] `GetDevice.test.ts` — by id, by slug, missing → AppError
- [x] `CreateDevice.test.ts` — happy path, slug collision → AppError
- [x] `UpdateDevice.test.ts` — partial fields, not_found
- [x] `DeleteDevice.test.ts` — happy path, cascade clears `device_subscriptions`/`device_images`
- [x] `ToggleDevice.test.ts` — flips flag, idempotent

## Route tests

- [x] `src/routes/api/v1/devices/+server.test.ts` — GET returns paginated `{ items, total, … }`; POST returns 201 + body
- [x] `[slug]/+server.test.ts` — GET 200/404; PATCH 200/404; DELETE 204/404
- [x] `[slug]/toggle/+server.test.ts` — POST 200, body matches schema
- [-] Unauthenticated path returns 401 (uses 003's gate) — gate tested in 003; routes call runtime directly, auth not in route scope

## Docs

- [x] No user-facing env changes → skip docs site
- [x] Confirm `engineering/ARCHITECTURE.md` §Service layer reflects mixin codestyle — no dedicated section; service.md is the authoritative doc, code matches

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [x] Smoke: curl create → get → patch → list → toggle → delete against running daemon
- [ ] `lefthook` pre-commit + commit-msg pass — runs at commit time (reviewer)

## Commit + push

- [ ] `feat(service-devices): CRUD + toggle service, API routes, paginated list`
- [ ] Co-author trailer + push
- [ ] `Status: done` here
- [ ] README index updated
- [ ] `chore(plans): mark 004-service-devices done` committed + pushed
