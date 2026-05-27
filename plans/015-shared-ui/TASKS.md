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
- [-] Manual smoke web: list / create / edit / delete / toggle identical to pre-migration — DEFERRED to user (interactive browser + running daemon required; not performable in the autonomous loop, and the daemon can't boot headless here due to the sharp `libstdc++` env issue). Code-level verified via `bun run check` + `bun run build` + hook/endpoint unit tests.

## Phase 3 — remaining verticals

- [x] Subscriptions: hooks + universal load + SPA form migration + delete server form actions (Part A: hooks + tests done; Part B1: list + runs-history done; Part B2a: sources API + new-page migration done; Part B2b: detail page migration done)
- [x] Images / gallery: hooks + universal load (gallery uses cursor pagination — hook owns cursor state); favorite / tag / blacklist / restore via mutation hooks
- [x] Runs: hooks + universal load (SSE stream unchanged, only list/detail/active data fetch migrates)
- [x] `.claude/rules/frontend.md` §Data flow — rewrite rule per IMPLEMENTATION.md §Decisions
- [x] Audit every remaining `+page.server.ts` — survivors are auth-only and legitimate: `login/+page.server.ts` (sets session cookie) + `(app)/+layout.server.ts` (auth gate, reads `locals.user` → redirect, no business-logic service call). No other `+page.server.ts` remains.
- [-] Final manual smoke across every page — DEFERRED to user (same reason as Phase 2 smoke: needs interactive browser + running daemon).
- [-] Latency sanity-check: heaviest page (gallery) SSR first paint — DEFERRED to user (needs the running daemon to measure). Note: with the static-adapter mobile build the gallery is client-rendered anyway; on web the universal-load loopback is a single in-process hop.

## Verification gates

- [x] `bun run check` clean — 0 errors (9 pre-existing `state_referenced_locally` warnings, none blocking)
- [x] `bun test` green — all slice tests pass; the only failures are the 33 pre-existing `sharp` `ERR_DLOPEN_FAILED` environmental failures (see `.builder-notes.md`), unrelated to this slice
- [x] `bunx eslint .` zero errors (1 pre-existing `no-explicit-any` warning in `service/base.ts`)
- [x] `bunx prettier --check .` clean
- [-] Manual smoke per migrated page: behavior unchanged — DEFERRED to user (interactive; see Phase 2/3 smoke notes)
- [x] Per-page sanity: reviewer confirmed each migrated page — server load deleted, `+page.ts` universal load present, form actions removed / hand-rolled submits routed through mutation hooks, `apiFetch`-based hooks wired
- [-] `lefthook` pre-commit + commit-msg — N/A in this environment (`core.hooksPath` points at a Nix store dir with only a `commit-msg` hook; no `pre-commit`, `lefthook` not on PATH). Gates were run manually each iteration instead. Lefthook still enforces on a normal dev machine + CI.

## Commit + push

- [x] Phase 1: `feat(client-config): runtime-configurable API base URL via $client/config`
- [x] Phase 2: shipped as `feat(shared-ui): add devices data + mutation hooks` + `feat(shared-ui): migrate devices routes to universal load + SPA forms`
- [x] Phase 3: shipped across the subscriptions (hooks/B1/B2a/B2b), images (hooks + wiring), and runs commits, plus the frontend-rule rewrite
- [x] `Status: done` in IMPLEMENTATION.md
- [x] README index updated for `015-shared-ui`
- [x] Bookkeeping: `chore(plans): mark 015-shared-ui done`
