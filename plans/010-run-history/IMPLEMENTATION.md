# 010 — Run history

## Status

**not-started**

## Goal

Service + API for `run_history`: list runs (paginated), get a single run,
list runs scoped to a subscription, and a Server-Sent Events stream for
live status updates. Prune to last 100 runs per subscription on insert
(the insert side is in the pipeline from 009; this slice adds the
prune trigger).

## Decisions (pre-baked)

- **Operations** (`src/lib/server/service/runs/`):
  - `ListRuns` — paginated, optional filter `{ subscription_id?, status?, since?, until? }`.
  - `GetRun` — by id.
  - `ListSubscriptionRuns` — convenience: filter pinned to subscription.
  - `GetActiveRuns` — `status = 'running'`, no pagination, capped at
    100 rows.
- **API shape**:
  - `GET /api/v1/runs`
  - `GET /api/v1/runs/[id]`
  - `GET /api/v1/runs/active`
  - `GET /api/v1/runs/stream` (SSE — emits `run.update` events whenever
    the pipeline writes a counter or status change)
  - `GET /api/v1/subscriptions/[id]/runs` (added to 005's route tree)
- **SSE bus**: in-process `EventEmitter` at
  `src/lib/server/runs/bus.ts`. The ingest pipeline (009) imports +
  emits `run.update` events on each significant write. SSE handler
  subscribes and forwards.
- **Prune trigger**: SQL trigger created by a new migration
  `0003_run_history_prune_trigger.sql`. After insert on
  `run_history`, delete rows for that subscription beyond rank 100
  ordered by `started_at DESC, id DESC`.
- **Live emit hook**: 009's pipeline already updates counters in a
  separate UPDATE. Wrap those updates in a small helper
  `update_run(runtime, run_id, patch)` that also emits the bus event.
  Helper lives in `src/lib/server/runs/update.ts` and 009 should
  already use it after this slice's hook lands — if 009 doesn't yet,
  add a TODO to 009's resume (this slice can add a small refactor PR
  if needed).
- **SSE keep-alive**: emit `: ping\n\n` every 15s to defeat proxy
  timeouts.

## State at end of slice

- `src/lib/server/service/runs/*` mixins
- `src/lib/schemas/runs/*` Zod schemas
- `src/lib/server/runs/{bus,update}.ts`
- New migration `0003_run_history_prune_trigger.sql`
- SSE route + plain GET routes
- Tests: service, route, prune trigger, SSE handshake

## Resume here

1. Read `engineering/ARCHITECTURE.md` §Run history + §SSE.
2. Migration: prune trigger (see Decisions). Use STRICT-friendly SQL.
3. `runs/bus.ts` — `EventEmitter` singleton + typed `emit_update(run)`
   - `subscribe(listener)`.
4. `runs/update.ts` — `update_run(runtime, run_id, patch)` performs
   the UPDATE inside a transaction, fetches the updated row, emits.
5. Hook the pipeline (009) calls to use `update_run` instead of raw
   UPDATEs. If 009 hasn't landed yet, add a TODO comment in the
   pipeline file and proceed — the hook can be wired retroactively
   without breaking anything.
6. Schemas + services per `.claude/rules/service.md`.
7. SSE handler:
   ```ts
   export function GET(event) {
     const stream = new ReadableStream({
       start(controller) {
         const send = (data) => controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
         const ping = setInterval(() => controller.enqueue(`: ping\n\n`), 15_000)
         const unsubscribe = bus.subscribe(send)
         event.request.signal.addEventListener("abort", () => {
           clearInterval(ping)
           unsubscribe()
           controller.close()
         })
       },
     })
     return new Response(stream, {
       headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
     })
   }
   ```
8. Tests:
   - Service: insert/list/get; prune trigger fires (insert 105 rows for
     one subscription → assert 100 remain).
   - Route: GET 200/404; SSE response headers + at least one event
     delivered when bus emits.
   - Helper: `update_run` emits exactly once per call.
9. Smoke: SSE via `curl -N` while running a real subscription;
   counters tick in real time.
10. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — SSE test uses streaming Response reader
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Migration applies clean
- [ ] Smoke: `curl -N http://127.0.0.1:5173/api/v1/runs/stream` shows
      `data:` lines during a real ingest
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(run-history): list/get/active/SSE-stream API, prune-to-100 trigger
```

Body: list filters, prune trigger, SSE bus, 15s keepalive, update_run
helper. Co-author. Push. Then `chore(plans): mark 010-run-history done`.

## Gotchas

- SSE buffer flush: SvelteKit + Bun.serve respects backpressure;
  `controller.enqueue` is sync but the consumer may be slow. Don't
  buffer infinite emits — drop on backpressure (or `pause()`-aware
  bus); MVP simplification: ignore backpressure since the bus is
  bounded by the number of subs.
- Prune trigger uses `WHERE id NOT IN (SELECT id FROM run_history WHERE
subscription_id = NEW.subscription_id ORDER BY started_at DESC,
id DESC LIMIT 100)` — index on `(subscription_id, started_at DESC,
id DESC)` must exist (verify against 001 schema; add covering index
  here if missing).
- Active-runs query lives in-process — no need to consult disk; it's a
  trivial SELECT. Don't over-engineer.

## Deferred

- Per-device run breakdown chart → 013-webui-runs visualisation.
- Run retention archival to S3-ish → out of scope.
- Cancelling a running run from the UI → post-MVP.
