# 002 — HTTP integration

## Status

**not-started**

## Goal

`bun run src/cli.ts serve` should boot the runtime, start the scheduler tick,
and serve the SvelteKit handler over HTTP in the same Bun process — staying
alive until SIGTERM / SIGINT, flushing the OTel SDK on shutdown. Add a
`/healthz` route so the Docker `HEALTHCHECK` and any K8s liveness probe
have something to probe.

Today `serve` calls `boot()` and exits immediately. This slice closes that
gap.

## Design notes (decide as you go)

- **SvelteKit handler import.** With `svelte-adapter-bun`, the build output
  exposes a `handler` we can plug into `Bun.serve`. In dev (`bun run dev`),
  Vite owns the server, so the daemon does NOT serve in dev mode — dev =
  Vite + a separate scheduler invocation (or skip the scheduler in dev,
  which is fine for now). Production = built `./build` + `Bun.serve`.
- **Same-process scheduler.** `boot()` already returns `Runtime`. Start the
  cron tick (`scheduler/cron.ts`) once after `boot()`. The tick interval is
  60s. Don't tick before HTTP is up — order: `boot` → start scheduler →
  start HTTP → wait.
- **`/healthz`** is a thin SvelteKit `+server.ts` returning `200 ok` with a
  trivial DB ping (`db.run("select 1")`). Path is **unauthenticated** even
  when `WALLRUS_AUTH_ENABLE=true` — the Docker healthcheck has no creds.
  Add an exception in `hooks.server.ts` for `/healthz` once auth lands
  (the 003 slice will do this; for now hooks.server.ts is a no-op anyway).
- **Graceful shutdown.** SIGTERM / SIGINT handlers in `cli.ts`: stop the
  scheduler tick, call `Bun.serve`'s `stop()`, await `sdk.shutdown()` to
  flush exporters, close DB, exit 0. Default timeout 5s.
- **Dev parity.** Add a `bun run dev:scheduler` script for running the
  scheduler tick alongside `bun run dev` during local development. Optional
  — most dev work won't need it.

## Resume here

Concrete first step for the next session:

1. Skim `engineering/ARCHITECTURE.md` §Bootstrap sequence and §Scheduler.
2. Open `src/cli.ts`. After `boot()`, add the `Bun.serve` wiring and the
   scheduler start.
3. Touch `src/routes/healthz/+server.ts` with the trivial 200 handler.
4. Touch `src/lib/server/scheduler/cron.ts` — promote the placeholder to a
   `setInterval`-driven tick that reads `enabled, deleted_at IS NULL`
   subscriptions, evaluates each `croner` next-fire, and `queue.enqueue`s
   them. For this slice the executor body can stay a `console.log` (or
   `getLogger().info`) placeholder — real ingest lands in `005-ingest`.
5. Wire SIGTERM/SIGINT handlers in `cli.ts`.
6. Update `bunfig.toml` if dev startup wants a side-script invocation.
7. Update `engineering/ARCHITECTURE.md` §Bootstrap sequence if the order
   shifts.
8. Update `docs/src/content/docs/{en,id}/configuration/docker.md` if the
   healthcheck path or any operator-visible behaviour changes.
9. Run gates + smoke test:
   - `bun run check && bun test`
   - Boot the daemon, `curl http://127.0.0.1:5173/healthz` → `200 ok`.
   - Send SIGTERM, verify clean exit + telemetry flush.

## Gotchas

- The `WALLRUS_LISTEN_ADDR` default is `0.0.0.0:5173`; parse it into
  `{ hostname, port }` for `Bun.serve({ port, hostname })`. Don't pass
  the raw string.
- `svelte-adapter-bun` builds output at `./build/`. Run `bun run build`
  before testing `serve` in production mode.
- For dev mode (`bun run dev`), do NOT also call `Bun.serve` from
  `serve` subcommand — Vite owns dev. Gate on
  `process.env.NODE_ENV === "production"` or on a `--mode` flag.
- The scheduler tick must NOT start in dev mode either, otherwise every
  `bun run dev` will start scraping Reddit. Same gate.
- The `/healthz` route must bypass the auth gate. Either explicit allowlist
  in `hooks.server.ts` (when 003 lands) or special-case in the route.

## Deferred

- Real scheduler executor body — `005-ingest`.
- Auth gate that respects `/healthz` exception — `003-auth`.
- Admin Unix socket for CLI mutations — post-MVP per scope.
- Graceful drain of in-flight runs on SIGTERM — keep simple-kill for now;
  in-flight ingests will get marked `daemon_crash` by the next boot's
  crash-recovery sweep.
