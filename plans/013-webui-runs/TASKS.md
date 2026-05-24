# 013 — WebUI: run dashboard — tasks

## Components

- [x] `src/lib/components/RunStatusBadge.svelte` — colours per status, pulse on running
- [x] `src/lib/components/RunRow.svelte` — row layout
- [x] `src/lib/components/RunDetail.svelte` — counters + params snapshot + error
- [x] `src/lib/components/Sparkline.svelte` — bar of last-N statuses (optional but ship)

## Pages

- [x] `src/routes/(app)/runs/+page.svelte` + `+page.ts` — paginated list + EventSource subscribe
- [x] `src/routes/(app)/runs/[id]/+page.svelte` + `+page.ts` — detail
- [x] `src/routes/(app)/subscriptions/[id]/runs/+page.svelte` — scoped history

## SSE client

- [x] `src/lib/client/runs-stream.ts` — `subscribe(callback): () => void`
- [x] Exponential backoff (1s, 2s, 4s) on reconnect
- [x] Falls back to `setInterval(fetch_active, 10_000)` after 3 failed reconnects
- [x] Cleanup closes EventSource + clears timers

## Tests

- [x] `RunStatusBadge.test.ts` — renders per status
- [x] `RunRow.test.ts` — formats duration, counters
- [x] `RunDetail.test.ts` — error string visible when present
- [x] `runs-stream.test.ts` — reconnect logic with fake EventSource + fake timers
- [-] Playwright `tests/e2e/runs.spec.ts`: Playwright webServer doesn't call set_runtime() — same blocker as slices 011 + 012. Defer until a Playwright-bootstrap slice rewires `webServer`.

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green
- [-] `bun run test:e2e` — Playwright bootstrap blocker (same as slices 011 + 012)
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [-] Manual smoke: SSE updates UI live — requires running daemon + browser session, outside builder scope
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-runs): run dashboard with SSE live updates and per-subscription history`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 013-webui-runs done` committed + pushed

## Final completion (only if every prior slice is `done`)

- [ ] Output `<promise>WALLRUS-MVP-COMPLETE</promise>` so the Ralph loop exits cleanly
