# 013 — WebUI: run dashboard

## Status

**not-started**

## Goal

Run dashboard at `/runs` + per-subscription run history at
`/subscriptions/[id]/runs`. Live status via the 010 SSE stream.
Closes the MVP loop: operator can see ingest activity, drill into a
failed run, view counters, see the input_params snapshot.

## Decisions (pre-baked)

- **Routes**:
  - `/runs` — last 100 runs across all subscriptions, paginated 20/page
  - `/runs/[id]` — single-run detail (counters, params snapshot, error
    message if failed)
  - `/subscriptions/[id]/runs` — per-subscription history
- **Live**: page subscribes to `/api/v1/runs/stream` via `EventSource`.
  Updates patch the in-memory row store; UI re-renders.
- **Components**:
  - `RunRow.svelte` — one row in a table; status badge, duration,
    `items_seen`/`items_new`/`items_failed_download` summary.
  - `RunDetail.svelte` — the detail view.
  - `RunStatusBadge.svelte` — color-coded badge (running=pulse,
    success=green, failed=red).
  - `Sparkline.svelte` — last-N-runs success/fail bar (optional but
    cheap; defer if time-constrained).
- **Empty state**: "No runs yet. Subscriptions will run on their cron."
- **Live polling fallback**: if EventSource disconnects + can't
  reconnect after 3 tries, switch to 10s `setInterval` polling of
  `/api/v1/runs/active`.

## State at end of slice

- Three pages
- Four components
- Playwright spec covers `/runs` load + receives at least one SSE
  event during a scripted run.

## Resume here

1. Read `.claude/rules/frontend.md` §SSE client.
2. Build the components in this order: badge, row, sparkline, detail.
3. `/runs` page: initial list via load fn, then EventSource subscription.
4. `/runs/[id]` detail.
5. `/subscriptions/[id]/runs` reuses the row component, filtered list.
6. Reconnection logic: exponential backoff (1s, 2s, 4s) then polling
   fallback.
7. Tests:
   - Component tests for badge / row / detail.
   - Playwright e2e: start the daemon with a subscription cronned to
     fire immediately, visit `/runs`, expect a row with `running` then
     transitioning to `success` within 30s.
8. Verification gates → commit + push.
9. **Output the completion promise** if every other slice is `done`
   (per `plans/RALPH.md`).

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green — SSE live update verified
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke: trigger a run, watch `/runs` update live
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(webui-runs): run dashboard with SSE live updates and per-subscription history
```

Body: pages, components, EventSource subscribe + reconnect, polling
fallback, Playwright spec. Co-author. Push. Then
`chore(plans): mark 013-webui-runs done`.

**After this commit + push lands, and all other slices are done**, emit:

```
<promise>WALLRUS-MVP-COMPLETE</promise>
```

## Gotchas

- `EventSource` doesn't send custom headers — auth must be via cookie.
  When `WALLRUS_AUTH_ENABLE=true` and the user used Basic auth (no
  cookie), the SSE stream would be 401. Document this in the user
  docs as a known limitation, or fall back to polling on 401.
- The SSE handler from 010 uses keepalive `: ping`; client should
  ignore comments (`event.data` starts empty for those — `EventSource`
  doesn't fire `message` for comments anyway).
- Reconnection bookkeeping: Svelte 5 `$effect` cleanup is the right
  place to close the EventSource and clear timers.
- Don't mutate the runs array in place — replace it (`runs = [...runs.map(r => r.id === incoming.id ? incoming : r)]`) so reactivity fires.

## Deferred

- Cancel run from UI → post-MVP.
- Per-device add chart → post-MVP.
- Run search / filter by stop_reason → folded into the list filter
  query string if time permits.
