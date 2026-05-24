# 010 — Run history — tasks

## Migration

- [ ] `drizzle/migrations/0003_run_history_prune_trigger.sql` — AFTER INSERT trigger pruning to 100 rows per subscription
- [ ] Index `(subscription_id, started_at DESC, id DESC)` confirmed on run_history (add if missing)
- [ ] Migration applies clean on a fresh DB

## Bus + update helper

- [ ] `src/lib/server/runs/bus.ts` — EventEmitter singleton, `emit_update(run)`, `subscribe(listener): () => void`
- [ ] `src/lib/server/runs/update.ts` — `update_run(runtime, run_id, patch)` updates DB + emits
- [ ] Unit test: `subscribe` receives emits, `unsubscribe` stops
- [ ] Unit test: `update_run` emits exactly once per call

## Schemas

- [ ] `src/lib/schemas/runs/Run.ts` — DTO
- [ ] `src/lib/schemas/runs/{ListRuns,GetRun,ListSubscriptionRuns,GetActiveRuns}.ts`
- [ ] `index.ts` barrel
- [ ] Unit test: filter combinations parse

## Services

- [ ] `service/runs/{base,ListRuns,GetRun,ListSubscriptionRuns,GetActiveRuns,index}.ts`
- [ ] `@traced` + `withQueryName` on each
- [ ] `runtime.services.runs` exposed

## Routes

- [ ] `src/routes/api/v1/runs/+server.ts` — GET (list)
- [ ] `src/routes/api/v1/runs/active/+server.ts` — GET
- [ ] `src/routes/api/v1/runs/stream/+server.ts` — SSE GET
- [ ] `src/routes/api/v1/runs/[id]/+server.ts` — GET
- [ ] `src/routes/api/v1/subscriptions/[id]/runs/+server.ts` — GET

## Tests

- [ ] Prune trigger test: insert 105 rows for one subscription → 100 remain, newest 100
- [ ] Service tests: list filters, get not_found, active rows only
- [ ] Route tests: GET 200/404
- [ ] SSE test: subscribe, emit one update via bus, assert event delivered to client
- [ ] SSE test: keepalive `: ping` line every 15s (use fake timers)
- [ ] SSE test: abort signal closes the stream + unsubscribes

## Pipeline integration

- [ ] If 009 already merged: convert raw UPDATEs to `update_run` calls
- [ ] If 009 not yet merged: leave a TODO comment in `pipeline.ts` flagged for 010

## Smoke

- [ ] `curl -N http://127.0.0.1:5173/api/v1/runs/stream` shows `data:` lines while a real ingest runs
- [ ] `GET /api/v1/runs?status=success&limit=10` returns paginated list
- [ ] `GET /api/v1/runs/active` returns 0 rows when nothing is running

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Migration clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(run-history): list/get/active/SSE-stream API, prune-to-100 trigger`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 010-run-history done` committed + pushed
