---
paths:
  - "src/lib/server/service/**"
  - "src/lib/schemas/**"
  - "src/lib/server/fanout.ts"
  - "src/lib/server/thumbnail.ts"
  - "src/lib/server/scheduler/**"
---

# wallrus — service layer rules

`src/lib/server/service/*` holds **all business logic**. Routes, hooks, and scheduler are thin callers.

## Hard rules

1. **All business logic lives here.** SvelteKit routes (`+page.server.ts`, `+server.ts`), `hooks.server.ts`, and the scheduler are **thin wrappers** that call services. They never compose multi-table writes, never embed filter logic, never reach into the DB schema beyond passing IDs and primitives.
2. **Services never touch auth control flow.** No checking tokens, no inspecting cookies, no reading user identity. Auth is gated upstream in `hooks.server.ts` and at the route layer. Services receive validated typed inputs and trust them. Don't `import` anything from the auth module from a service file.
3. **Services are HTTP-unaware.** No `Request`, `Response`, `RequestEvent`, `cookies`, headers, status codes. They take typed inputs, return typed outputs, throw typed errors. Route handlers translate to HTTP shapes.
4. **No `JSON.parse` / `JSON.stringify` for DB-bound JSON columns.** Use the Drizzle `customType<T>()` declared in `db/schema.ts`. See [`database.md`](./database.md) §SQLite conventions #4.
5. **Multi-write operations wrap in a transaction.** `db.transaction(tx => { … })` — see [`database.md`](./database.md) §Transactions.
6. **Time discipline.** Services use `Date.now()` to populate `*_at` columns; never `new Date().toISOString()` for storage. ISO conversion happens at the API boundary (route layer), not here.
7. **Throw typed errors.** Define an `AppError` union (e.g. `NotFoundError`, `ConflictError`, `ValidationError`). Route handlers map these to HTTP status codes in one place. No `throw new Error("string")` in services.

## Code style — mixin composition

Services use a **mixin-based class composition** pattern. Each operation is a mixin function that extends a `Base` class; domain services compose all their operation mixins into one class.

### Folder structure (schemas split from operations)

Schemas live in a **universal** location (`src/lib/schemas/`) so they are importable by client-side Svelte code too. Server operations live under `src/lib/server/service/` and import their schemas from the universal path. The two trees mirror each other — each `<Op>.ts` in `server/service/<domain>/` has a sibling `<Op>.ts` in `schemas/<domain>/`. Same filename in both trees (no `.schema` suffix needed since the parent dir already implies it).

```
src/lib/
  schemas/                                  # UNIVERSAL — Zod schemas / DTOs / types
    devices/
      ListDevices.ts                        # client-importable
      GetDevice.ts
      CreateDevice.ts
      ...
    subscriptions/
      ListSubscriptions.ts
      ...
    images/  runs/  sources/  favorites/
  server/
    service/                                # SERVER-ONLY — operation mixins
      base.ts                               # Base class + Dependencies type + Constructor type
      index.ts                              # top-level Service aggregator
      devices/
        index.ts                            # composes mixins -> exports DeviceService
        ListDevices.ts                      # mixin: ListDevices(Base); imports from $lib/schemas/devices/ListDevices
        GetDevice.ts
        CreateDevice.ts
        ...
      subscriptions/  images/  runs/  sources/  favorites/
```

**Why split?** SvelteKit refuses to bundle anything under `$lib/server/**` into the client. If a schema lives there, no `.svelte` file or route's universal load can `import` it. Putting schemas at `$lib/schemas/<domain>/<Op>.ts` makes them importable everywhere — including for client-side form validation that mirrors the server contract exactly.

### `base.ts`

```ts
// src/lib/server/service/base.ts
export type Dependencies = {
  // db, telemetry-bound logger, sharp, clock fn, etc. — populated as services need them
}

export class Base {
  constructor(deps: Dependencies) {
    // store deps; subclass mixins access via `this`
  }
}

export type Constructor<T extends Base = Base> = new (...args: any[]) => T
```

### One operation per file

```ts
// src/lib/server/service/devices/ListDevices.ts
import { type Constructor } from "../base"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import type {
  ListDevicesRequest,
  ListDevicesResponse,
} from "$lib/schemas/devices/ListDevices"

export function ListDevices<T extends Constructor>(Base: T) {
  return class ListDevices extends Base {
    @traced()
    async listDevices(req: ListDevicesRequest): Promise<ListDevicesResponse> {
      // …
    }
  }
}
```

### Per-operation Zod schema (universal — `$lib/schemas/...`)

```ts
// src/lib/schemas/devices/ListDevices.ts
import { z } from 'zod'

export const ListDevicesRequestSchema = z.object({
  next:   z.uuid().optional(),
  prev:   z.uuid().optional(),
  offset: z.int().min(0).default(0),
  limit:  z.int().min(1).max(100).default(20),
})
export type ListDevicesRequest = z.infer<typeof ListDevicesRequestSchema>

export const ListDevicesResponseSchema = z.object({
  items: z.array(/* DeviceDTO schema */),
  total: z.int(),
  next_cursor: z.uuid().optional(),
  prev_cursor: z.uuid().optional(),
})
export type ListDevicesResponse = z.infer<typeof ListDevicesResponseSchema>
```

### Domain aggregator

```ts
// src/lib/server/service/devices/index.ts
import { Base } from "../base"
import { ListDevices } from "./ListDevices"
import { GetDevice } from "./GetDevice"
import { CreateDevice } from "./CreateDevice"
// ...

const Service = CreateDevice(GetDevice(ListDevices(Base)))

export class DeviceService extends Service { }
```

Operation mixins compose left-to-right with `Base` at the innermost. Adding a new operation = one line in this `index.ts`.

### Top-level service aggregator

```ts
// src/lib/server/service/index.ts
import type { Dependencies } from "./base"
import { DeviceService } from "./devices"
import { SubscriptionService } from "./subscriptions"
import { ImageService } from "./images"
// ...

export class Service {
  devices:       DeviceService
  subscriptions: SubscriptionService
  images:        ImageService
  // ...
  constructor(deps: Dependencies) {
    this.devices       = new DeviceService(deps)
    this.subscriptions = new SubscriptionService(deps)
    this.images        = new ImageService(deps)
  }
}
```

Bootstrap instantiates one `Service` and passes it to callers (routes get it via `locals.service` set in `hooks.server.ts`; scheduler gets it directly).

### Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Operation file | `PascalCase.ts` under `$lib/server/service/<domain>/` | `ListDevices.ts` |
| Schema file | `PascalCase.ts` under `$lib/schemas/<domain>/` | `ListDevices.ts` (same filename as the operation) |
| Method name | `camelCase` matching the file | `listDevices()` |
| Request schema | `<Op>RequestSchema` | `ListDevicesRequestSchema` |
| Request type | `<Op>Request` | `ListDevicesRequest` |
| Response schema | `<Op>ResponseSchema` | `ListDevicesResponseSchema` |
| Response type | `<Op>Response` | `ListDevicesResponse` |
| Decorator | `@traced()` on every public method | `@traced() async listDevices(...)` |
| Method signature | `(req: <Op>Request): Promise<<Op>Response>` | one typed input, one typed output |
| Domain folder | `lowercase plural noun` | `devices/`, `subscriptions/`, `images/` |
| Domain class | `<Domain>Service` | `DeviceService` |

### Telemetry

- Every public service method carries `@traced()` from `@tigorhutasuhut/telemetry-js/bun`. The decorator creates a span named after the method.
- Inside methods, use the logger from `Dependencies` (or the telemetry singleton). Never `console.log`.
- Log levels: `debug` for hot-path detail, `info` for state transitions, `warn` for recoverable anomalies, `error` for failures. Never log credentials, full request bodies, or response payloads.

## Special files

- `_pagination.ts` — typed `paginate<T>(…)` helper used by every list operation. Returns `{ items, total, next_cursor?, prev_cursor? }` per the pagination contract in [`api.md`](./api.md).
- `_errors.ts` — `AppError` union: `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError` (reserved post-MVP). Underscore prefix = internal helper, not a domain service.

## Patterns

### Listing

Each list operation composes `paginate<T>()`. The trailing `, id` tie-breaker is enforced inside the helper.

```ts
@traced()
async listDevices(req: ListDevicesRequest): Promise<ListDevicesResponse> {
  return paginate({
    table: devices,
    where: /* filter from req */,
    order: [desc(devices.created_at), desc(devices.id)],   // MANDATORY ", id" tie-breaker
    cursor: req,
  })
}
```

### Single-item fetch

```ts
@traced()
async getDevice(req: GetDeviceRequest): Promise<GetDeviceResponse> {
  const row = await this.deps.db.query.devices.findFirst({ where: eq(devices.id, req.id) })
  if (!row) throw new NotFoundError(`device:${req.id}`)
  return to_dto(row)
}
```

### Mutation

Mutations return the final row (using upsert + RETURNING * where applicable). Routes / form actions are responsible for `invalidate*()` on the SvelteKit side.

### Ingest pipeline (images)

One transaction per item ingested. Detailed in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §Ingest pipeline. Key invariants:

- Soft-deleted row resurrection on re-encounter: clear `deleted_at`, re-download, re-fanout.
- Blacklisted row: skip entirely (no download, no fanout).
- Cross-source SHA256 dedup: one row per `source_url`, multiple rows can share `sha256` + on-disk file via hardlink.
- Per-item transaction so partial writes don't leave half-state.

### Filter evaluation

Pure function: `evaluate(image, device.filter_criteria) → boolean`. Lives in `filter.ts`. Side-effect-free, easy to unit-test.

## DTOs

- Services return DTOs (plain TS types defined alongside the operation), not raw Drizzle rows.
- DTO conversion happens at service exit. Timestamps remain ms-since-epoch; JSON columns are already typed via `customType`.
- DTOs hide internal fields: never expose `password`, raw credential `payload`, etc.

## Test discipline

- Services are the primary unit-test surface. Inject a clock (no `Date.now()` directly — use a `clock()` helper on `Dependencies`) and an in-memory SQLite DB.
- Pure helpers (`filter.evaluate`, `_pagination` order builder) get tight tests without DB.
- Integration tests cover the ingest pipeline end-to-end against a real `bun:sqlite` instance.

## Don't

- Don't check auth, read cookies, or inspect identity inside services.
- Don't `import { fetch }` to call your own `/api/v1/*` from a service. Direct DB / direct other-service call only.
- Don't accept or return `Request`/`Response`/`URL`/`URLSearchParams`/`Headers`.
- Don't `console.log` — use the telemetry logger.
- Don't `JSON.parse` a DB column — typed customType only.
- Don't write ad-hoc SQL strings for listing — use the `paginate<T>()` helper so every list query gets the mandatory `, id` tie-breaker.
- Don't introduce a service that knows about HTTP status codes — throw typed errors and let the route layer map.
- Don't write services without `@traced()` on the public methods.
- Don't break the mixin composition pattern — every new operation gets its own `<Op>.ts` under `$lib/server/service/<domain>/` paired with a same-named `<Op>.ts` under `$lib/schemas/<domain>/`, and composes into the domain `index.ts`.
- Don't put schemas under `$lib/server/` — they must stay universal so the client can import them.
- Don't import anything server-only (`bun:sqlite`, `drizzle-orm`, `sharp`, `@tigorhutasuhut/telemetry-js/bun`, etc.) from a schema file under `$lib/schemas/`. Pure `zod` only.
