# 005 — Service: subscriptions — tasks

## Sources registry contract

- [x] `src/lib/server/sources/_registry.ts` — `register(entry)`, `lookup(slug)`, `list()`
- [x] Entry shape `{ slug, input_schema: ZodTypeAny, description?: string }`
- [x] Bootstrap calls a `register_sources()` aggregator (today a stub; 007/008 fill it)
- [x] Unit test: register + lookup roundtrip, lookup-missing returns null

## Scheduler reload

- [x] `src/lib/server/scheduler/cron.ts` adds `reload(runtime): Promise<void>`
- [x] Reload rebuilds the per-subscription Cron map atomically
- [x] Reload safe when scheduler not started (warn + no-op)
- [x] Unit test: `reload` after a `CreateSubscription` includes the new id
- [x] Unit test: `reload` before `start` is a no-op

## Schemas

- [x] `src/lib/schemas/subscriptions/Subscription.ts` — DTO
- [x] `src/lib/schemas/subscriptions/{ListSubscriptions,GetSubscription,CreateSubscription,UpdateSubscription,DeleteSubscription,ToggleSubscription,LinkDevice,UnlinkDevice,ListSubscriptionDevices}.ts`
- [x] `index.ts` barrel
- [x] Unit test: `CreateSubscriptionRequest` parses; cron invalid → Zod error; unknown source slug → Zod error (refine via registry)

## Services

- [x] `service/subscriptions/base.ts`
- [x] 9 operation mixins matching Decisions
- [x] Each `@traced` + `withQueryName("subscriptions.<op>")`
- [x] `DeleteSubscription` writes `deleted_at = unixepoch() * 1000`
- [x] Create/Update/Delete/Toggle call `scheduler.reload` AFTER commit
- [x] `service/subscriptions/index.ts` barrel + `runtime.services.subscriptions`

## Routes

- [x] `src/routes/api/v1/subscriptions/+server.ts` — GET + POST
- [x] `[id]/+server.ts` — GET + PATCH + DELETE
- [x] `[id]/toggle/+server.ts` — POST
- [x] `[id]/devices/+server.ts` — GET + POST
- [x] `[id]/devices/[device_id]/+server.ts` — DELETE
- [x] All gated by auth, all use `app_error_to_response`

## Service tests

- [x] `ListSubscriptions.test.ts` — empty / populated / `enabled` filter / `source_slug` filter / `include_deleted=true` vs default
- [x] `GetSubscription.test.ts`
- [x] `CreateSubscription.test.ts` — happy path, bad cron, unknown source
- [x] `UpdateSubscription.test.ts` — partial, not_found, reload triggered
- [x] `DeleteSubscription.test.ts` — soft-delete sets `deleted_at`, reload triggered
- [x] `ToggleSubscription.test.ts`
- [x] `LinkDevice.test.ts` — happy path, duplicate (UNIQUE) → AppError
- [x] `UnlinkDevice.test.ts` — happy path, missing pair → 404
- [x] `ListSubscriptionDevices.test.ts`

## Route tests

- [x] One test per endpoint asserting status + shape
- [-] Unauthenticated → 401 from 003 gate (auth is gated at SvelteKit hook level, not testable via direct handler invocation; covered by 003 slice)
- [x] Soft-deleted subscription absent from default list, present with `include_deleted=true`

## Docs

- [x] No env changes → skip docs site
- [x] `engineering/ARCHITECTURE.md` §Sources registry confirmed accurate (no changes needed)

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green (272 pass, 0 fail)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in base.ts)
- [x] `bunx prettier --check .` clean
- [x] Smoke: create with unknown source → 400 validation.unknown_source; list → 200 empty; get nonexistent → 404
- [-] `lefthook` pre-commit + commit-msg pass (runs at commit time — reviewer task)

## Commit + push

- [ ] `feat(service-subscriptions): CRUD + soft-delete + device link, cron validation, scheduler reload`
- [ ] Co-author trailer + push
- [ ] `Status: done` here
- [ ] README index updated
- [ ] `chore(plans): mark 005-service-subscriptions done` committed + pushed
