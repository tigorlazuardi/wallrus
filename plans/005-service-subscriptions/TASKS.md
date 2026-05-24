# 005 — Service: subscriptions — tasks

## Sources registry contract

- [ ] `src/lib/server/sources/_registry.ts` — `register(entry)`, `lookup(slug)`, `list()`
- [ ] Entry shape `{ slug, input_schema: ZodTypeAny, description?: string }`
- [ ] Bootstrap calls a `register_sources()` aggregator (today a stub; 007/008 fill it)
- [ ] Unit test: register + lookup roundtrip, lookup-missing returns null

## Scheduler reload

- [ ] `src/lib/server/scheduler/cron.ts` adds `reload(runtime): Promise<void>`
- [ ] Reload rebuilds the per-subscription Cron map atomically
- [ ] Reload safe when scheduler not started (warn + no-op)
- [ ] Unit test: `reload` after a `CreateSubscription` includes the new id
- [ ] Unit test: `reload` before `start` is a no-op

## Schemas

- [ ] `src/lib/schemas/subscriptions/Subscription.ts` — DTO
- [ ] `src/lib/schemas/subscriptions/{ListSubscriptions,GetSubscription,CreateSubscription,UpdateSubscription,DeleteSubscription,ToggleSubscription,LinkDevice,UnlinkDevice,ListSubscriptionDevices}.ts`
- [ ] `index.ts` barrel
- [ ] Unit test: `CreateSubscriptionRequest` parses; cron invalid → Zod error; unknown source slug → Zod error (refine via registry)

## Services

- [ ] `service/subscriptions/base.ts`
- [ ] 9 operation mixins matching Decisions
- [ ] Each `@traced` + `withQueryName("subscriptions.<op>")`
- [ ] `DeleteSubscription` writes `deleted_at = unixepoch() * 1000`
- [ ] Create/Update/Delete/Toggle call `scheduler.reload` AFTER commit
- [ ] `service/subscriptions/index.ts` barrel + `runtime.services.subscriptions`

## Routes

- [ ] `src/routes/api/v1/subscriptions/+server.ts` — GET + POST
- [ ] `[id]/+server.ts` — GET + PATCH + DELETE
- [ ] `[id]/toggle/+server.ts` — POST
- [ ] `[id]/devices/+server.ts` — GET + POST
- [ ] `[id]/devices/[device_id]/+server.ts` — DELETE
- [ ] All gated by auth, all use `app_error_to_response`

## Service tests

- [ ] `ListSubscriptions.test.ts` — empty / populated / `enabled` filter / `source_slug` filter / `include_deleted=true` vs default
- [ ] `GetSubscription.test.ts`
- [ ] `CreateSubscription.test.ts` — happy path, bad cron, unknown source
- [ ] `UpdateSubscription.test.ts` — partial, not_found, reload triggered
- [ ] `DeleteSubscription.test.ts` — soft-delete sets `deleted_at`, reload triggered
- [ ] `ToggleSubscription.test.ts`
- [ ] `LinkDevice.test.ts` — happy path, duplicate (UNIQUE) → AppError
- [ ] `UnlinkDevice.test.ts` — happy path, missing pair → 404
- [ ] `ListSubscriptionDevices.test.ts`

## Route tests

- [ ] One test per endpoint asserting status + shape
- [ ] Unauthenticated → 401 from 003 gate
- [ ] Soft-deleted subscription absent from default list, present with `include_deleted=true`

## Docs

- [ ] No env changes → skip docs site
- [ ] `engineering/ARCHITECTURE.md` §Sources registry confirmed accurate

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke: create / link device / toggle / soft-delete via curl
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(service-subscriptions): CRUD + soft-delete + device link, cron validation, scheduler reload`
- [ ] Co-author trailer + push
- [ ] `Status: done` here
- [ ] README index updated
- [ ] `chore(plans): mark 005-service-subscriptions done` committed + pushed
