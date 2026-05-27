# 015 — Shared UI — tasks

## Phase 1 — client foundation

- [x] `$lib/client/config.ts` — `api_base()` + `set_api_base(url)`, normalises trailing slash, defaults to `import.meta.env.PUBLIC_API_BASE ?? ""`
- [x] `$lib/client/config.test.ts` — unit tests (empty default, set/get, trailing slash normalised)
- [x] `$lib/client/fetcher.ts` — wire `api_base()` into every `/api/v1/*` call
- [x] `$lib/client/fetcher.test.ts` — empty base = relative URL = web no-op; non-empty base = absolute URL
- [x] `.env.example` — add `PUBLIC_API_BASE=` documented as "empty for web, set at runtime on mobile"

## Phase 2 — pilot vertical: devices

- [x] `$lib/client/devices/use-devices.svelte.ts` — list hook, accepts optional `initial`, exposes `{ state, refetch }`
- [x] `$lib/client/devices/use-device.svelte.ts` — single-device hook
- [x] `$lib/client/devices/use-device-mutation.svelte.ts` — `{ create, update, delete, toggle }` action funcs returning parsed response
- [x] Audit `src/lib/components/devices/*` for presenter purity (no `+page.server.ts` import, no `$app/stores` page read, no `fetch`). Refactor offenders.
- [x] `src/routes/(app)/devices/+page.server.ts` → `+page.ts` universal load via `fetch("/api/v1/devices")`
- [x] `src/routes/(app)/devices/new/+page.server.ts` form action → superforms `SPA: true` + `useDeviceMutation().create`
- [x] `src/routes/(app)/devices/[slug]/edit/+page.server.ts` form action → SPA superforms + `update`
- [x] Toggle / delete flows: client POST via mutation hook
- [x] Delete superseded server form actions + server loads
- [x] Hook unit tests (`use-devices.test.ts`, `use-device-mutation.test.ts`)
- [ ] Manual smoke web: list / create / edit / delete / toggle identical to pre-migration

## Phase 3 — remaining verticals

- [x] Subscriptions: hooks + universal load + SPA form migration + delete server form actions (Part A: hooks + tests done; Part B1: list + runs-history done; Part B2a: sources API + new-page migration done; Part B2b: detail page migration done)
- [~] Images / gallery: hooks + universal load (gallery uses cursor pagination — hook owns cursor state); favorite / tag / blacklist / restore via mutation hooks
- [ ] Runs: hooks + universal load (SSE stream unchanged, only list/detail/active data fetch migrates)
- [ ] `.claude/rules/frontend.md` §Data flow — rewrite rule per IMPLEMENTATION.md §Decisions
- [ ] Audit every remaining `+page.server.ts` — keep `/login` (cookie set) and tag any other explicitly "web-only" page; remove the rest
- [ ] Final manual smoke across every page
- [ ] Latency sanity-check: heaviest page (gallery) SSR first paint should stay single-digit ms regression; document if not

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke per migrated page: behavior unchanged
- [ ] Per-page sanity: server load deleted, `+page.ts` universal load present, form actions deleted, `SPA: true` superform present, mutation hook called
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] Phase 1: `feat(client-config): runtime-configurable API base URL via $client/config`
- [ ] Phase 2: `feat(shared-ui): extract devices vertical to presenter + hook + universal load`
- [ ] Phase 3: `feat(shared-ui): migrate subscriptions/images/runs to presenter + hook pattern`
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated for `015-shared-ui`
- [ ] Bookkeeping: `chore(plans): mark 015-shared-ui done`
