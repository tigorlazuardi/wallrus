# 002 — HTTP integration: tasks

## Env + parsing

- [ ] Add `parse_listen_addr(raw: string): { hostname: string; port: number }` to `src/lib/server/env.ts`
- [ ] `parse_listen_addr` throws `AppError("env.invalid", …)` on malformed input
- [ ] Unit test: `src/lib/server/env.test.ts` — 4+ cases (`"0.0.0.0:5173"`, `"5173"` rejects, `"foo:bar"` rejects, `":5173"` defaults host)
- [ ] Add `WALLRUS_MODE: z.enum(["prod","dev"]).default("prod")` to env schema if not already present

## Runtime singleton

- [ ] Create `src/lib/server/runtime.ts` exporting `set_runtime(r)` + `runtime_ref()`
- [ ] `runtime_ref()` throws if `set_runtime` not yet called (no silent undefined)
- [ ] Unit test: `runtime_ref()` before `set_runtime` throws; after set returns the same instance

## Scheduler queue

- [ ] Create `src/lib/server/scheduler/queue.ts`
- [ ] Export `enqueue(source_slug, fn): Promise<void>` with per-slug serial chaining
- [ ] Export `wait_idle(): Promise<void>` resolving when all chains drain
- [ ] Unit test: two enqueues same slug run sequentially (timestamps assert order)
- [ ] Unit test: enqueues across different slugs overlap (timestamps assert concurrency)
- [ ] Unit test: `wait_idle` resolves only after all in-flight chains complete

## Scheduler tick

- [ ] Promote `src/lib/server/scheduler/cron.ts` from stub
- [ ] Export `start(runtime: Runtime): void` loading enabled, non-soft-deleted subscriptions once
- [ ] Build per-subscription `croner` `Cron` instances keyed by subscription id
- [ ] `setInterval(tick, 60_000)` evaluates `nextRun()` in the next 60s and `queue.enqueue`s
- [ ] Executor body = `getLogger({ module: "scheduler" }).info("would run", { subscription_id })`
- [ ] Export `stop(): Promise<void>` clearing interval + awaiting `queue.wait_idle()` (5s cap)
- [ ] Unit test: fake `Date.now` + one subscription row → executor stub invoked once per tick window
- [ ] Unit test: `stop` after `start` clears interval and drains queue

## Healthcheck route

- [ ] Create `src/routes/healthz/+server.ts` exporting `GET`
- [ ] Returns `200 ok` text/plain on `db.run("select 1")` success
- [ ] Returns `503 db not ready` when the ping throws (caught + logged)
- [ ] No external deps, no auth checks
- [ ] Add `db` to `Locals` interface in `src/app.d.ts`

## Hooks wiring

- [ ] `src/hooks.server.ts`: set `event.locals.db = runtime_ref().db`
- [ ] Keep `event.locals.user = null` for now (auth lands in 003)

## CLI serve

- [ ] `src/cli.ts` `serve` action no longer exits after `boot()`
- [ ] Gate Bun.serve block on `env.WALLRUS_MODE === "prod" || process.env.NODE_ENV === "production"`
- [ ] Dynamic `import("../build/handler.js")` wrapped in try/catch; ENOENT logs build-missing + exit 1
- [ ] `set_runtime(runtime)` called pre-server-start
- [ ] `scheduler.start(runtime)` called pre-server-start
- [ ] `const server = Bun.serve({ port, hostname, fetch: handler })` running
- [ ] `getLogger({ module: "http" }).info("listening", { hostname, port })`
- [ ] SIGTERM + SIGINT handlers registered (same `shutdown(signal)` body)
- [ ] Shutdown body: `scheduler.stop()` → `server.stop()` → `runtime.sdk.shutdown()` → `runtime.db.close()` → `process.exit(0)`
- [ ] Hard-exit fallback via `setTimeout(() => process.exit(1), 5_000).unref()`

## Docs

- [ ] `engineering/ARCHITECTURE.md` §Bootstrap sequence reflects new order (boot → scheduler → HTTP → wait)
- [ ] `engineering/ARCHITECTURE.md` §Scheduler clarifies in-process tick + 60s interval + queue
- [ ] `docs/src/content/docs/en/configuration/docker.md` healthcheck section verified accurate
- [ ] `docs/src/content/docs/id/configuration/docker.md` mirrors the EN update

## Verification gates (run before commit)

- [ ] `bun run check` clean
- [ ] `bun test` green (new cases covered)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `bun run build` succeeds
- [ ] Smoke: `WALLRUS_MODE=prod bun run src/cli.ts serve` boots; `curl http://127.0.0.1:5173/healthz` → 200 `ok`
- [ ] Smoke: `kill -TERM <pid>` exits 0 within 5s, log shows `shutdown` + OTel flush
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] Single commit: `feat(http-integration): serve SvelteKit + scheduler from cli.ts, add /healthz`
- [ ] Body lists Bun.serve, scheduler tick stub, /healthz, SIGTERM/SIGINT, parse_listen_addr
- [ ] `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer present
- [ ] `git push`
- [ ] Set `Status: done` in this slice's `IMPLEMENTATION.md`
- [ ] Update `plans/README.md` index row for `002-http-integration` to `done`
- [ ] Commit + push the bookkeeping: `chore(plans): mark 002-http-integration done`

## Deferred from this slice

- Real auth gate logic + `/healthz` exception → `003-auth`
- Real scheduler executor body → `009-ingest-pipeline`
- `scheduler.reload()` on subscription mutations → `005-service-subscriptions`
- Admin Unix socket for CLI mutations → post-MVP per scope
