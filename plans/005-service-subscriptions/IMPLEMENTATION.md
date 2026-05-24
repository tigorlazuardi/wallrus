# 005 — Service: subscriptions

## Status

**not-started**

## Goal

`subscriptions` domain end-to-end: services under
`src/lib/server/service/subscriptions/`, schemas under
`src/lib/schemas/subscriptions/`, REST endpoints under
`src/routes/api/v1/subscriptions/`. CRUD + cron validation + soft-delete +
many-to-many link/unlink with devices + scheduler reload trigger.

## Decisions (pre-baked)

- **Operations**:
  - `ListSubscriptions` — paginated, optional filters `{ enabled?,
source_slug?, include_deleted? }`.
  - `GetSubscription` — by id.
  - `CreateSubscription` — `{ source_slug, input_params,
cron, max_items_inspected? }`.
  - `UpdateSubscription` — partial update by id.
  - `DeleteSubscription` — sets `deleted_at = unixepoch() * 1000`.
  - `ToggleSubscription` — `{ id, enabled }`.
  - `LinkDevice` — POST `{ subscription_id, device_id }` inserts
    `device_subscriptions` row.
  - `UnlinkDevice` — DELETE the join row.
  - `ListSubscriptionDevices` — list devices subscribed to a subscription.
- **Cron validation**: use `new Cron(expression, { paused: true })` from
  croner inside the service; catch + rethrow as
  `AppError("validation.cron_invalid", err.message)`.
- **`input_params` validation**: per-source Zod schema. Each source module
  exports `input_schema` (e.g. `RedditInputSchema`,
  `BooruInputSchema`). The service looks up the schema by `source_slug`
  from a registry exposed by `src/lib/server/sources/_registry.ts`.
  Registry is populated by sources slices (007, 008) but the lookup
  must already be in place here — for sources not yet implemented,
  registry returns a Zod `passthrough` schema with a warning log so this
  slice can land without 007/008.
- **Scheduler reload**: after every successful Create/Update/Delete/Toggle,
  the service calls `scheduler.reload(runtime)` (added to `cron.ts`
  here — a function that rebuilds the `Map<id, Cron>`). Reload is a no-op
  if the scheduler hasn't been `start`-ed (dev mode).
- **Pagination contract**: same as 004.
- **API shape**:
  - `GET /api/v1/subscriptions` (list)
  - `POST /api/v1/subscriptions` (create)
  - `GET /api/v1/subscriptions/[id]`
  - `PATCH /api/v1/subscriptions/[id]`
  - `DELETE /api/v1/subscriptions/[id]` (soft)
  - `POST /api/v1/subscriptions/[id]/toggle`
  - `GET /api/v1/subscriptions/[id]/devices` (list joined devices)
  - `POST /api/v1/subscriptions/[id]/devices` body `{ device_id }`
  - `DELETE /api/v1/subscriptions/[id]/devices/[device_id]`

## State at end of slice

- `src/lib/server/service/subscriptions/{base,ListSubscriptions,GetSubscription,CreateSubscription,UpdateSubscription,DeleteSubscription,ToggleSubscription,LinkDevice,UnlinkDevice,ListSubscriptionDevices,index}.ts`
- `src/lib/schemas/subscriptions/*` Zod schemas + DTO
- `src/lib/server/sources/_registry.ts` populated with the contract
  `{ slug → { input_schema } }`; bootstrap calls `register_sources()`
  which today is a no-op until 007/008 fill it in.
- Routes wired.
- `scheduler.reload(runtime)` exported from `src/lib/server/scheduler/cron.ts`.
- `runtime.services.subscriptions` available.

## Resume here

1. Read `.claude/rules/service.md`, `.claude/rules/api.md`, and
   `engineering/ARCHITECTURE.md` §Sources registry §Scheduler.
2. Create `src/lib/server/sources/_registry.ts` with shape `{ slug:
string; input_schema: ZodTypeAny }`. Export `register(entry)`,
   `lookup(slug): entry | null`, `list(): entry[]`.
3. Extend `src/lib/server/scheduler/cron.ts` with `reload(runtime)`.
   Reload is safe to call when `start` hasn't run (no-op + warn).
4. Schemas: write `Subscription.ts` DTO + operation request/response
   schemas. `CreateSubscription` validates cron via croner + delegates
   `input_params` validation to registry lookup; if registry returns
   null, fail with `validation.unknown_source`.
5. Services: 9 mixins per Decisions, all `@traced`.
6. Routes: 8 endpoints; same error-mapping pattern as 004.
7. Tests:
   - Unit: every operation, including cron-invalid path and unknown-source
     path.
   - Integration: each route handler.
   - Scheduler reload assertion: after `CreateSubscription`, the
     in-memory `Map<id, Cron>` includes the new id.
8. Smoke: create subscription with cron `*/5 * * * *`, link a device,
   list subscriptions filtered by `enabled=true`, soft-delete, confirm
   list with `include_deleted=true` returns it.
9. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke per "Resume here" step 8
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(service-subscriptions): CRUD + soft-delete + device link, cron validation, scheduler reload
```

Body: list ops, cron+input_params validation, sources registry contract,
scheduler reload, M2M endpoints. Co-author trailer. Push.

`chore(plans): mark 005-service-subscriptions done`.

## Gotchas

- Cron string lives in DB as-is (TEXT); validate before insert. Don't
  store a parsed form.
- `input_params_snapshot` lives in `run_history` (per-run snapshot of the
  exact params used) — this slice doesn't touch run_history but
  `Update` must NOT also rewrite historical snapshots. Just update the
  current row.
- M2M endpoints use composite key `(subscription_id, device_id)` — the
  reverse index from 001 makes `WHERE device_id = ?` cheap.
- `scheduler.reload` is sync-ish (rebuilds an in-memory map). Don't block
  on it inside a write transaction — reload AFTER commit.

## Deferred

- Subscription form UI → 012-webui-device (form lives on the device page
  per scope: "device pages subscribe to sources"). Adjust if 012's layout
  later contradicts this.
