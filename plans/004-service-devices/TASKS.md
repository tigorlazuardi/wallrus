# 004 — Service: devices — tasks

## Shared helpers

- [ ] `src/lib/server/http/pagination.ts`: `parse_pagination`, `encode_cursor`, `decode_cursor`
- [ ] Unit test: cursor encode/decode roundtrip
- [ ] Unit test: malformed cursor returns null (no throw)
- [ ] Unit test: `limit` clamped to `[1, 200]`, default 50
- [ ] `src/lib/server/http/errors.ts`: `app_error_to_response`
- [ ] Unit test: each known `AppError` code maps to expected status

## Schemas

- [ ] `src/lib/schemas/devices/DeviceFilters.ts` — Zod object per Decisions
- [ ] `src/lib/schemas/devices/Device.ts` — DTO
- [ ] `src/lib/schemas/devices/{ListDevices,GetDevice,CreateDevice,UpdateDevice,DeleteDevice,ToggleDevice}.ts` request + response schemas
- [ ] `src/lib/schemas/devices/index.ts` barrel
- [ ] Unit test: `DeviceFilters` rejects unknown keys (strict)
- [ ] Unit test: `CreateDeviceRequest.slug` regex `[a-z0-9-]{1,64}` enforced

## Service

- [ ] `src/lib/server/service/devices/base.ts`
- [ ] `ListDevices.ts` — paginated, `@traced`, `withQueryName("devices.list")`, deterministic `, id` tie-breaker
- [ ] `GetDevice.ts` — by id or slug, throws `AppError("not_found.device", …)` if missing
- [ ] `CreateDevice.ts` — Drizzle insert with `RETURNING *`, throws `AppError("validation.slug_taken", …)` on UNIQUE violation
- [ ] `UpdateDevice.ts` — partial update; throws not_found if 0 rows
- [ ] `DeleteDevice.ts` — hard delete
- [ ] `ToggleDevice.ts` — sets enabled flag
- [ ] `index.ts` barrel composing mixins into `DeviceService`
- [ ] `runtime.ts` exposes `runtime.services.devices` (lazy-instantiated)

## Routes

- [ ] `src/routes/api/v1/devices/+server.ts` — GET + POST
- [ ] `src/routes/api/v1/devices/[slug]/+server.ts` — GET + PATCH + DELETE
- [ ] `src/routes/api/v1/devices/[slug]/toggle/+server.ts` — POST
- [ ] Each handler: Zod-parse → call service → return JSON, catch via `app_error_to_response`
- [ ] All handlers use `request.json()` only for write bodies

## Service tests

- [ ] In-memory DB helper: `src/test/db.ts` creates a fresh `:memory:` SQLite, runs migrations, returns a Drizzle handle
- [ ] `ListDevices.test.ts` — empty, populated, pagination forward, pagination backward (`prev`), `enabled` filter
- [ ] `GetDevice.test.ts` — by id, by slug, missing → AppError
- [ ] `CreateDevice.test.ts` — happy path, slug collision → AppError
- [ ] `UpdateDevice.test.ts` — partial fields, not_found
- [ ] `DeleteDevice.test.ts` — happy path, cascade clears `device_subscriptions`/`device_images`
- [ ] `ToggleDevice.test.ts` — flips flag, idempotent

## Route tests

- [ ] `src/routes/api/v1/devices/+server.test.ts` — GET returns paginated `{ items, total, … }`; POST returns 201 + body
- [ ] `[slug]/+server.test.ts` — GET 200/404; PATCH 200/404; DELETE 204/404
- [ ] `[slug]/toggle/+server.test.ts` — POST 200, body matches schema
- [ ] Unauthenticated path returns 401 (uses 003's gate)

## Docs

- [ ] No user-facing env changes → skip docs site
- [ ] Confirm `engineering/ARCHITECTURE.md` §Service layer reflects mixin codestyle

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke: curl create → get → patch → list → toggle → delete against running daemon
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(service-devices): CRUD + toggle service, API routes, paginated list`
- [ ] Co-author trailer + push
- [ ] `Status: done` here
- [ ] README index updated
- [ ] `chore(plans): mark 004-service-devices done` committed + pushed
