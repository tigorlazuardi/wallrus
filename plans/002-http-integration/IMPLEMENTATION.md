# 002 — HTTP integration

## Status

**done**

## Goal

`bun run src/cli.ts serve` boots the runtime, starts the scheduler tick,
and serves the SvelteKit handler over HTTP in the same Bun process —
staying alive until SIGTERM / SIGINT, flushing the OTel SDK on shutdown.
Adds `/healthz` so the Docker `HEALTHCHECK` and any K8s liveness probe
have a stable endpoint to hit.

## Decisions (pre-baked — do not relitigate)

- **HTTP host**: `Bun.serve({ port, hostname, fetch })`. The SvelteKit
  handler is imported from `./build/handler.js` (produced by
  `svelte-adapter-bun` on `bun run build`). The CLI `serve` action
  requires the build artifact; if absent, log `getLogger().error("missing
./build/handler.js — run `bun run build` first")` and exit 1.
- **Production vs dev**: `bun run src/cli.ts serve` is **production-only**.
  Local dev keeps using `bun run dev` (Vite-managed). Gate the Bun.serve
  block on `process.env.NODE_ENV === "production" || env.WALLRUS_MODE ===
"prod"`. Default `WALLRUS_MODE=prod` so a bare `bun run src/cli.ts serve`
  outside of Vite still works.
- **Listen address**: parse `WALLRUS_LISTEN_ADDR` (default `0.0.0.0:5173`)
  via a new exported helper `parse_listen_addr(raw: string): { hostname,
port }`. Lives in `src/lib/server/env.ts`. Throws `AppError` on invalid
  input.
- **Scheduler tick**: `setInterval(tick, 60_000)`. The body of `tick()`
  loads enabled, non-soft-deleted subscriptions, asks each per-subscription
  `croner` instance whether `nextRun()` falls within the next 60s, and
  calls `queue.enqueue(subscription_id)` if yes. **Executor body stays a
  `getLogger().info("would run", { subscription_id })` stub** — real ingest
  lands in `009-ingest-pipeline`. Tick is started **after** HTTP is up.
- **Queue**: in-memory; same-source serialisation handled by keying on
  `source_slug`. Implemented in `src/lib/server/scheduler/queue.ts` with
  a `Map<source_slug, Promise<void>>` chain.
- **`/healthz`**: returns `200 ok` text/plain after `db.run("select 1")`
  succeeds; returns `503` with `db not ready` body if the ping throws.
  Path is **unauthenticated** — `hooks.server.ts` already lets everything
  through (the 003 slice will add an allowlist that keeps `/healthz`,
  `/api/v1/otel/discover`, and `/otlp/*` open).
- **Graceful shutdown**: `cli.ts` registers handlers for `SIGTERM` and
  `SIGINT`. On signal: stop the scheduler tick (`clearInterval`), call
  `server.stop()` from the `Bun.serve` handle, await
  `runtime.sdk.shutdown()` to flush OTel exporters, close the DB
  (`runtime.db.close()`), `process.exit(0)`. Hard-exit fallback after
  5_000ms (`setTimeout(() => process.exit(1), 5_000).unref()`).
- **Logger source**: every log line in this slice uses
  `getLogger({ module: "http" | "scheduler" | "lifecycle" })` so OTel
  attributes pre-tag the source.

## State at end of slice (target)

- `src/cli.ts` no longer exits after `boot()`; `serve` is a long-running
  daemon that owns HTTP + scheduler + shutdown handlers.
- `src/routes/healthz/+server.ts` returns 200/503 based on the DB ping.
- `src/lib/server/scheduler/cron.ts` exports `start(runtime)` and
  `stop()`. The tick is wired but the executor is a no-op log.
- `src/lib/server/scheduler/queue.ts` provides `enqueue(source_slug, fn)`
  serialising by source.
- `src/lib/server/env.ts` exports `parse_listen_addr` with unit test
  coverage.
- `engineering/ARCHITECTURE.md` §Bootstrap sequence reflects
  `boot → scheduler.start → server = Bun.serve → wait`.
- Docker healthcheck transitions to `healthy`.

## Resume here

Execute these steps in order. Each item ends with a verification line
(curl/test/grep) that must be green before the next.

1. **Open `engineering/ARCHITECTURE.md` §Bootstrap sequence and §Scheduler**;
   reconcile the order described against the Decisions above. If they
   conflict, edit `ARCHITECTURE.md` to match Decisions.
2. **`src/lib/server/env.ts`**: add and export `parse_listen_addr(raw):
{ hostname: string; port: number }`. Throw `new AppError("env.invalid",
"WALLRUS_LISTEN_ADDR must be host:port")` on bad input.
   Verify: `bun test src/lib/server/env.test.ts` passes with new cases
   (`"0.0.0.0:5173"` → ok, `"5173"` → throws, `"foo:bar"` → throws,
   `":5173"` → defaults host to `0.0.0.0`).
3. **`src/lib/server/scheduler/queue.ts`** (new file): export
   `enqueue(source_slug: string, fn: () => Promise<void>): Promise<void>`
   chaining promises per `source_slug`. Plus
   `wait_idle(): Promise<void>` that resolves when all queues are empty
   (used by shutdown).
   Verify: unit test covers serialisation (two enqueues with the same
   slug run sequentially) and parallelism (different slugs run
   concurrently — assert overlap via timestamps).
4. **`src/lib/server/scheduler/cron.ts`**: promote to functional.
   - Export `start(runtime: Runtime): void` and `stop(): Promise<void>`.
   - `start` loads `subscriptions WHERE enabled = 1 AND deleted_at IS
NULL` once at boot, builds a `Map<id, Cron>` of `croner` instances,
     and sets `setInterval(tick, 60_000)`. **Do not** auto-reload on
     subscription mutations — that's `005-service-subscriptions`'s job
     via an explicit `scheduler.reload()` export.
   - `tick` iterates the map; for each Cron whose `nextRun()` falls
     within `[now, now + 60_000)`, call `queue.enqueue(source_slug, async
() => { getLogger({ module: "scheduler" }).info("would run", {
subscription_id }); })`.
   - `stop` calls `clearInterval`, awaits `queue.wait_idle()` with a 5s
     timeout.
     Verify: unit test with a fake `Date.now` + a fake subscription row
     asserts the executor stub is invoked.
5. **`src/routes/healthz/+server.ts`** (new file): export `GET` that calls
   `event.locals.db.run("select 1")`. On success, `return new
Response("ok", { status: 200, headers: { "content-type": "text/plain"
} })`. On throw, return `503` with `db not ready` body and log the
   error.
   Note: `event.locals.db` does not exist yet; add it in
   `src/hooks.server.ts` (set `event.locals.db = runtime.db`). To get
   `runtime` into the hook, export a `set_runtime(r: Runtime)` from
   `src/lib/server/runtime.ts` (new module exporting a module-level
   `runtime` ref) and have `cli.ts serve` call it after `boot()`. Update
   `app.d.ts` to type `locals.db` as `Database`.
6. **`src/cli.ts`**: after `boot()`:
   - Call `set_runtime(runtime)`.
   - If `WALLRUS_MODE !== "prod"` and `NODE_ENV !== "production"`, log
     and exit (preserves existing dev ergonomics).
   - `const { default: handler } = await import("../build/handler.js")`
     wrapped in a try/catch — on `ENOENT` log the build-missing message
     and exit 1.
   - `scheduler.start(runtime)`.
   - `const { hostname, port } = parse_listen_addr(env.WALLRUS_LISTEN_ADDR)`.
   - `const server = Bun.serve({ port, hostname, fetch: handler })`.
   - `getLogger({ module: "http" }).info("listening", { hostname, port })`.
   - Register `SIGTERM` and `SIGINT`:
     ```ts
     const shutdown = async (signal: string) => {
       getLogger({ module: "lifecycle" }).info("shutdown", { signal })
       setTimeout(() => process.exit(1), 5_000).unref()
       await scheduler.stop()
       server.stop()
       await runtime.sdk.shutdown()
       runtime.db.close()
       process.exit(0)
     }
     process.on("SIGTERM", () => shutdown("SIGTERM"))
     process.on("SIGINT", () => shutdown("SIGINT"))
     ```
7. **`src/hooks.server.ts`**: set `event.locals.db = runtime_ref().db`
   from the new `runtime.ts` accessor. Keep `event.locals.user = null`.
8. **`src/app.d.ts`**: add `db: import("bun:sqlite").Database;` to the
   `Locals` interface.
9. **Smoke**:
   - `bun run build` (ensures `./build/handler.js` exists)
   - `WALLRUS_MODE=prod bun run src/cli.ts serve` in one shell
   - In another: `curl -s http://127.0.0.1:5173/healthz` → `ok`, exit code
     0
   - `kill -TERM <pid>` → process exits 0 within 5s, OTel flush logged
10. **Docs**:
    - `engineering/ARCHITECTURE.md` §Bootstrap sequence updated.
    - `docs/src/content/docs/en/configuration/docker.md` and
      `docs/src/content/docs/id/configuration/docker.md`: confirm the
      `HEALTHCHECK` path is `/healthz` (it already is per 001).
11. **Verification gates** — see "Verification gates" below.
12. **Commit + push** — see "Done definition" below.

## Verification gates

All must be green before the commit that closes this slice:

- [ ] `bun run check` — zero errors
- [ ] `bun test` — zero failures (new cases for `parse_listen_addr`,
      `queue.enqueue`, `cron.start`/`tick`)
- [ ] `bunx eslint .` — zero errors
- [ ] `bunx prettier --check .` — clean
- [ ] `bun run build` succeeds (no SvelteKit errors)
- [ ] Smoke: `WALLRUS_MODE=prod bun run src/cli.ts serve` then
      `curl http://127.0.0.1:5173/healthz` → `ok` (200)
- [ ] Smoke: SIGTERM exits within 5s, exit code 0, log contains
      `shutdown` line
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] `docker build -t wallrus:slice-002 .` builds and `docker run --rm
-e WALLRUS_AUTH_ENABLE=false -p 5173:5173 wallrus:slice-002` reports
      healthy within 60s (optional but recommended — Docker daemon
      required)

## Done definition

Single closing commit:

```
feat(http-integration): serve SvelteKit + scheduler from cli.ts, add /healthz
```

Body:

```
- Bun.serve hosts ./build/handler.js, replacing the boot-and-exit stub.
- Scheduler tick runs in-process (1-minute interval, stub executor).
- /healthz returns 200 on `select 1`, 503 otherwise; bypasses (future) auth.
- SIGTERM/SIGINT graceful shutdown with 5s hard-exit fallback,
  flushing OTel SDK and the in-memory scheduler queue.
- parse_listen_addr helper + unit tests.
```

Trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Push immediately: `git push`.

Then set this file's `Status:` to `done` and update
`plans/README.md` index status to `done` in a follow-up
`chore(plans): mark 002-http-integration done` commit (also pushed).

## Gotchas

- The `WALLRUS_LISTEN_ADDR` default is `0.0.0.0:5173`; pass parsed
  `{ hostname, port }` to `Bun.serve` — never the raw string.
- `svelte-adapter-bun` outputs `./build/handler.js`. If the loop forgets
  `bun run build`, the dynamic `import()` will throw `ENOENT`. Surface a
  helpful error message rather than the raw stack.
- `/healthz` must NOT hit the (future) auth gate. When `003-auth` lands,
  its allowlist must include `/healthz`, `/api/v1/otel/discover`, and
  `/otlp/*`. This slice predates that gate so just keep the path
  side-effect-free.
- `bun:sqlite` `Database#close()` after `runtime.sdk.shutdown()` matters
  — flushing exporters can issue final spans referencing DB queries; do
  not close the DB first.
- Don't double-tick: `setInterval(tick, 60_000)` starts ticking 60s after
  registration. If you want a fire-on-boot, call `tick()` once explicitly
  before `setInterval`. This slice does **not** fire on boot (avoids a
  surprise ingest seconds after start before the operator can intervene).
- The `runtime.ts` module-level singleton must be assigned **only by**
  `cli.ts serve` post-`boot()`. Hooks calling `runtime_ref()` before
  assignment must throw rather than return undefined.

## Deferred

- Real scheduler executor body — `009-ingest-pipeline`.
- Auth gate that respects the `/healthz` exception — `003-auth`.
- `scheduler.reload()` triggered by subscription mutations —
  `005-service-subscriptions`.
- Admin Unix socket for CLI mutations — post-MVP per scope.
- Graceful drain of in-flight ingest runs on SIGTERM — keep simple-kill
  for now; in-flight ingests are marked `daemon_crash` by the next
  boot's crash-recovery sweep.
