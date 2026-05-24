# 004 — Service: devices

## Status

**in-progress**

## Goal

Implement the `devices` domain end-to-end: service operations under
`src/lib/server/service/devices/`, wire-Zod schemas under
`src/lib/schemas/devices/`, REST endpoints under
`src/routes/api/v1/devices/`. CRUD + toggle + soft-delete. No UI yet
(that's 012).

## Decisions (pre-baked)

- **Codestyle**: mixin pattern per `.claude/rules/service.md`. One
  operation = one file (`ListDevices.ts`, `GetDevice.ts`, …) exporting
  a `@traced`-decorated mixin class extending `DeviceServiceBase`.
- **Operations** (final list):
  - `ListDevices` — paginated, optional filter `{ enabled? }`.
  - `GetDevice` — by id OR slug.
  - `CreateDevice` — `{ slug, name, filters }` → returns full row.
  - `UpdateDevice` — partial update by id.
  - `ToggleDevice` — `{ id, enabled }` shortcut.
  - `DeleteDevice` — hard delete (devices have no FK soft-delete need
    because their cascade simply removes `device_subscriptions` and
    `device_images` rows; the image rows themselves stay).
- **Pagination contract**: `{ next?, prev?, offset?, limit? }` →
  `{ items, total, next_cursor?, prev_cursor? }`. Cursor encodes
  `(created_at, id)` pair as base64url-JSON. `, id` is the deterministic
  tie-breaker. Default `limit=50`, max `limit=200`.
- **Slug rules**: lowercase, kebab, `[a-z0-9-]{1,64}`, COLLATE NOCASE
  uniqueness enforced by 001 schema. Zod `regex` + transform-to-lower.
- **Filters JSON shape** (column type `json` with `json_valid` CHECK):
  ```ts
  {
    res_min?: { w: number; h: number };
    res_max?: { w: number; h: number };
    aspect?: { value: number; tol: number };
    size_bytes?: { min?: number; max?: number };
    formats?: ("jpg" | "jpeg" | "png" | "webp" | "avif")[];
    tags_include?: string[];
    tags_exclude?: string[];
    nsfw?: "all" | "sfw_only" | "nsfw_only";
  }
  ```
  All fields optional. Zod schema is reused in 006 (image filtering)
  and 009 (ingest fan-out).
- **API shape**:
  - `GET /api/v1/devices` → paginated list
  - `POST /api/v1/devices` → create
  - `GET /api/v1/devices/[id_or_slug]` → get
  - `PATCH /api/v1/devices/[id_or_slug]` → update
  - `DELETE /api/v1/devices/[id_or_slug]` → delete
  - `POST /api/v1/devices/[id_or_slug]/toggle` → `{ enabled }`
- **Auth**: all 6 endpoints require auth (gated by 003 hooks).
- **Error shape**: `AppError`s thrown by services map to
  `{ error: { code, message } }` with HTTP status from a small
  `appErrorToStatus` helper (`auth.* → 401`, `validation.* → 400`,
  `not_found.* → 404`, default → 500). Helper lives at
  `src/lib/server/http/errors.ts`.

## State at end of slice

- `src/lib/server/service/devices/{base,ListDevices,GetDevice,CreateDevice,UpdateDevice,DeleteDevice,ToggleDevice,index}.ts`
- `src/lib/schemas/devices/{ListDevices,GetDevice,CreateDevice,UpdateDevice,DeleteDevice,ToggleDevice,DeviceFilters,Device,index}.ts`
- `src/routes/api/v1/devices/+server.ts` (list + create)
- `src/routes/api/v1/devices/[slug]/+server.ts` (get/patch/delete)
- `src/routes/api/v1/devices/[slug]/toggle/+server.ts`
- `src/lib/server/http/{errors,pagination}.ts`

## Resume here

1. Read `engineering/ARCHITECTURE.md` §Service layer and §Pagination,
   `.claude/rules/service.md`, `.claude/rules/api.md`.
2. **Pagination helper**: `src/lib/server/http/pagination.ts` exporting
   `parse_pagination(searchParams) → { limit, offset, next, prev }` +
   `encode_cursor / decode_cursor` (base64url-JSON over `(created_at,
id)`).
3. **Error helper**: `src/lib/server/http/errors.ts` exporting
   `app_error_to_response(err: unknown): Response` translating
   `AppError` codes to status + JSON body.
4. **Filters schema**: `src/lib/schemas/devices/DeviceFilters.ts` —
   the Zod object above. Export both the schema and the inferred type.
5. **`Device` DTO schema**: `src/lib/schemas/devices/Device.ts`.
6. **Service base**: `src/lib/server/service/devices/base.ts` exporting
   `class DeviceServiceBase` with `protected constructor(db, logger)`.
7. **Operation mixins**: one per file. Each `@traced` decorated, returns
   typed Zod-validated output. Use `withQueryName("devices.list")` etc.
8. **Service barrel**: `src/lib/server/service/devices/index.ts`
   composing mixins into `DeviceService`.
9. **Routes**: each handler imports `DeviceService` via
   `event.locals.runtime.services.devices` (add `services` to
   `runtime.ts` lazily; the runtime singleton exposes services hung
   off the DB).
10. **Tests**: see TASKS.md.
11. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — every operation has a unit test; routes have
      handler-level tests asserting status + body shape
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke: create → get → patch → list → toggle → delete via curl
      against a running `bun run src/cli.ts serve`, all responses match
      the Zod schemas
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(service-devices): CRUD + toggle service, API routes, paginated list
```

Body: list operations, filter JSON shape, pagination contract,
error mapping, test coverage. Co-author trailer. `git push`.

`chore(plans): mark 004-service-devices done` follows.

## Gotchas

- The seed `ListDevices.ts` from 001 throws `unimplemented` — overwrite
  it, don't add a sibling.
- Pagination cursor MUST decode safely (return null on bad input rather
  than throw); routes treat null as offset=0.
- `DELETE` is hard delete here; do NOT introduce soft-delete on devices.
  Subscriptions soft-delete (because of FK in `run_history`); devices
  don't have that constraint.
- Slug uniqueness is COLLATE NOCASE; tests must exercise `Foo` vs
  `foo` collision.

## Deferred

- Filter editor UI → 012-webui-device.
- Device-image listing endpoint → folded into 006-service-images.
