# 002 — HTTP integration: tasks

## Core wiring

- [ ] Parse `WALLRUS_LISTEN_ADDR` into `{ hostname, port }` (small helper in `src/lib/server/env.ts` or inline in `cli.ts`)
- [ ] Wire `Bun.serve` to host the SvelteKit handler imported from `./build/handler.js`
- [ ] Gate the production path on `process.env.NODE_ENV === "production"` (or a `--mode prod` flag); skip in dev
- [ ] Keep `serve` subcommand long-running — daemon stays alive until signalled

## Healthcheck

- [ ] `src/routes/healthz/+server.ts` returns `200 ok` with `db.run("select 1")` ping
- [ ] Path bypasses auth gate (noted explicitly in `hooks.server.ts` once it has one — for now the hook is a no-op)
- [ ] Verify `docker run` healthcheck transitions to `healthy`

## Scheduler

- [ ] Promote `src/lib/server/scheduler/cron.ts` from stub to functional
- [ ] On boot: load enabled + non-soft-deleted subscriptions, build a per-subscription croner instance
- [ ] `setInterval(tick, 60_000)` evaluates which subscriptions fire now and `queue.enqueue`s them
- [ ] Executor body stays a `getLogger().info("would run", { subscription_id })` placeholder — real ingest is `005-ingest`
- [ ] Skip scheduler start in dev mode

## Shutdown

- [ ] `cli.ts` registers `process.on("SIGTERM" | "SIGINT", handler)`
- [ ] Handler: stop scheduler tick, call `Bun.serve` instance `stop()`, await `runtime.sdk.shutdown()`, close DB, `process.exit(0)`
- [ ] Default 5s timeout — exit anyway after that

## Smoke + tests

- [ ] Unit test for `parse_listen_addr()` (or whatever the helper is named)
- [ ] Smoke: `bun run build && bun run serve` then `curl /healthz` → 200
- [ ] Smoke: SIGTERM → clean exit, telemetry flushed
- [ ] Playwright already has a smoke spec hitting `/`; verify still green against built handler under `Bun.serve` (or accept it stays as a Vite-only spec for now)

## Docs

- [ ] If healthcheck path / behaviour changed, update `docs/src/content/docs/{en,id}/configuration/docker.md`
- [ ] If install steps shifted, update `docs/src/content/docs/{en,id}/install.md`
- [ ] `engineering/ARCHITECTURE.md` §Bootstrap sequence: reflect the new "start scheduler → start HTTP → wait" order

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` 0 errors (warnings on placeholder mixins still OK)
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit

- [ ] One commit `feat(http-integration): serve SvelteKit + scheduler from cli.ts, add /healthz`
- [ ] Push, watch the GH Pages workflow stay green (it should — this slice doesn't touch `docs/**`)

## Deferred from this slice

- Real auth gate logic + `/healthz` exception → `003-auth`
- Real scheduler executor body → `005-ingest`
- Admin Unix socket for CLI mutations → post-MVP
