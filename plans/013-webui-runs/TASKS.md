# 013 — WebUI: run dashboard — tasks

## Components

- [ ] `src/lib/components/RunStatusBadge.svelte` — colours per status, pulse on running
- [ ] `src/lib/components/RunRow.svelte` — row layout
- [ ] `src/lib/components/RunDetail.svelte` — counters + params snapshot + error
- [ ] `src/lib/components/Sparkline.svelte` — bar of last-N statuses (optional but ship)

## Pages

- [ ] `src/routes/(app)/runs/+page.svelte` + `+page.ts` — paginated list + EventSource subscribe
- [ ] `src/routes/(app)/runs/[id]/+page.svelte` + `+page.ts` — detail
- [ ] `src/routes/(app)/subscriptions/[id]/runs/+page.svelte` — scoped history

## SSE client

- [ ] `src/lib/client/runs-stream.ts` — `subscribe(callback): () => void`
- [ ] Exponential backoff (1s, 2s, 4s) on reconnect
- [ ] Falls back to `setInterval(fetch_active, 10_000)` after 3 failed reconnects
- [ ] Cleanup closes EventSource + clears timers

## Tests

- [ ] `RunStatusBadge.test.ts` — renders per status
- [ ] `RunRow.test.ts` — formats duration, counters
- [ ] `RunDetail.test.ts` — error string visible when present
- [ ] `runs-stream.test.ts` — reconnect logic with fake EventSource + fake timers
- [ ] Playwright `tests/e2e/runs.spec.ts`:
  - Start daemon with a subscription cron `* * * * *`
  - Visit `/runs`
  - Within 90s a row transitions from `running` → `success`

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke: SSE updates UI live
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-runs): run dashboard with SSE live updates and per-subscription history`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 013-webui-runs done` committed + pushed

## Final completion (only if every prior slice is `done`)

- [ ] Output `<promise>WALLRUS-MVP-COMPLETE</promise>` so the Ralph loop exits cleanly
