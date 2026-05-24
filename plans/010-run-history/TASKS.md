# 010 — Run history — tasks

## Migration

- [x] `drizzle/migrations/0003_run_history_prune_trigger.sql` — AFTER INSERT trigger pruning to 100 rows per subscription
- [x] Index `(subscription_id, started_at DESC, id DESC)` confirmed on run_history (add if missing)
- [x] Migration applies clean on a fresh DB

## Bus + update helper

- [x] `src/lib/server/runs/bus.ts` — EventEmitter singleton, `emit_update(run)`, `subscribe(listener): () => void`
- [x] `src/lib/server/runs/update.ts` — `update_run(runtime, run_id, patch)` updates DB + emits
- [x] Unit test: `subscribe` receives emits, `unsubscribe` stops
- [x] Unit test: `update_run` emits exactly once per call

## Schemas

- [x] `src/lib/schemas/runs/Run.ts` — DTO
- [x] `src/lib/schemas/runs/{ListRuns,GetRun,ListSubscriptionRuns,GetActiveRuns}.ts`
- [x] `index.ts` barrel
- [x] Unit test: filter combinations parse

## Services

- [x] `service/runs/{base,ListRuns,GetRun,ListSubscriptionRuns,GetActiveRuns,index}.ts`
- [x] `@traced` + `withQueryName` on each
- [x] `runtime.services.runs` exposed

## Routes

- [x] `src/routes/api/v1/runs/+server.ts` — GET (list)
- [x] `src/routes/api/v1/runs/active/+server.ts` — GET
- [x] `src/routes/api/v1/runs/stream/+server.ts` — SSE GET
- [x] `src/routes/api/v1/runs/[id]/+server.ts` — GET
- [x] `src/routes/api/v1/subscriptions/[id]/runs/+server.ts` — GET

## Tests

- [x] Prune trigger test: insert 105 rows for one subscription → 100 remain, newest 100
- [x] Service tests: list filters, get not_found, active rows only
- [x] Route tests: GET 200/404
- [x] SSE test: subscribe, emit one update via bus, assert event delivered to client
- [-] SSE test: keepalive `: ping` line every 15s (use fake timers) — skipped; see stream/server.test.ts for rationale
- [x] SSE test: abort signal closes the stream + unsubscribes

## Pipeline integration

- [x] If 009 already merged: convert raw UPDATEs to `update_run` calls
- [-] If 009 not yet merged: leave a TODO comment in `pipeline.ts` flagged for 010

## Smoke

- [x] `curl -N http://127.0.0.1:5190/api/v1/runs/stream` — response opens with text/event-stream headers (200)
- [x] `GET /api/v1/runs?status=success&limit=10` returns `{"items":[],"total":0}` [200]
- [x] `GET /api/v1/runs/active` returns `{"items":[],"total":0}` [200]

## Verification gates

- [x] `bun run check` clean (0 errors, 1 pre-existing warning in login svelte)
- [x] `bun test` green (551 pass, 1 skip, 0 fail across 552 tests / 79 files)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in base.ts)
- [x] `bunx prettier --check .` clean
- [x] Migration clean (applied by run_migrations in test harness)
- [ ] `lefthook` pre-commit + commit-msg pass (reviewer commits)

## Commit + push

- [ ] `feat(run-history): list/get/active/SSE-stream API, prune-to-100 trigger`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 010-run-history done` committed + pushed
