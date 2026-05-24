# 001 — Foundation

## Status

**done** — covers commits `9a1964a` through `36f7879`. Everything from
scope-lock through OTLP browser-proxy is here.

## Goal

Establish the design foundation, the toolchain that enforces it, and the
runtime skeleton that future slices fill in. Specifically:

- Lock scope, architecture, and Claude rules so subsequent commits have a
  single source of truth.
- Stand up the dev-loop tooling (prettier, eslint, lefthook, commitlint,
  bun test, Playwright config) and pre-commit gates so quality stays high
  without manual discipline.
- Scaffold the daemon: Bun + SvelteKit + Tailwind v4 + Drizzle + bun:sqlite,
  Docker multi-stage image, GitHub Pages user-docs site, telemetry SDK
  wired in bootstrap, OTLP/HTTP browser-telemetry proxy.

## Decisions made during build (not in scope/arch docs)

- **STRICT / COLLATE NOCASE / DEFAULT 1** are NOT emitted by drizzle-kit
  when generating migrations from `schema.ts`. The generated SQL is
  manually patched after `bunx drizzle-kit generate --name initial_schema`
  to add those three patches. The migration file's header comments
  document the patches so they survive future regeneration.
- **PRAGMAs live in `db/client.ts`, not a migration.** Drizzle's migrator
  wraps each migration in a transaction; `PRAGMA journal_mode = WAL`
  errors with `cannot change into wal mode from within a transaction`
  inside one. Solution: apply all PRAGMAs on every connection open in
  `client.ts` (idempotent for WAL, mandatory for the session-scoped
  ones). The `0000_pragma.sql` migration was generated then dropped
  before any apply.
- **TypeScript 6** works. svelte-check + tsc clean. Telemetry-js stage-3
  decorators function under TS6 without `experimentalDecorators`.
- **Astro 6 + Starlight 0.39** build clean. No content changes were
  required by the major bumps.
- **GitHub username is `tigorlazuardi`** (not `tigorhutasuhut`, which is
  the npm scope owning `@tigorhutasuhut/telemetry-js`). All repo-URL
  docs were corrected after the first commits.
- **Pages must be enabled via `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`** before
  `actions/deploy-pages@v4` can deploy. The first two pushes 404'd until
  this was run.
- **GH Pages site URL**: `https://tigorlazuardi.github.io/wallrus/` with
  Astro `base: '/wallrus'`. Site/base overridable via env at build time
  (`WALLRUS_DOCS_SITE`, `WALLRUS_DOCS_BASE`).
- **OTLP proxy is HTTP-only.** gRPC collectors won't work. Body capped
  at 1 MiB.
- **`WALLRUS_OTEL_FRONTEND={enable,auth,disable}`** matrix (see
  `engineering/SCOPE.md`-adjacent + user docs):
  - `enable` (default) — public when wallrus auth off, gated when on.
  - `auth` — always requires auth (refuses with 401 even when wallrus
    auth is off globally).
  - `disable` — proxy returns 404.
- **`OTEL_EXPORTER_OTLP_HEADERS`** parses on the FIRST `=` per pair so
  `Authorization=Bearer eyJ…` survives intact.
- **Lazy `env()` singleton** in `src/lib/server/env.ts`. Bootstrap calls
  `parse_env()` (fail-fast); routes call `env()` to read the same cached
  parsed object without re-running Zod.
- **`no-console` ESLint rule** enforces `getLogger()` use under
  `src/**/*` (test files exempt).
- **Engineering vs user docs split**: `engineering/` holds contributor
  technical docs; `docs/` holds the Astro Starlight user site. Earlier
  `docs/SCOPE.md` + `docs/ARCHITECTURE.md` moved to `engineering/`
  before the Starlight scaffold landed.

## State at end of slice

What's wired and verifiable:

- **Bootstrap** (`src/lib/server/bootstrap.ts`): env → initSDK → fs
  perms (chmod 0700) → DB open → migrations (auto-applied) → DB perms
  (chmod 0600) → crash-recovery sweep → returns `Runtime { env, db, sdk }`.
- **DB schema**: 9 tables + FTS5 virtual + 3 triggers, all created on first
  boot. Junctions carry reverse composite indexes. UUIDv7 PKs everywhere.
  Aspect-ratio + duration_ms are `GENERATED VIRTUAL`.
- **CLI** (`src/cli.ts`): `wallrus serve` boots the runtime then exits.
  HTTP server NOT started yet — that's the 002 slice.
- **SvelteKit + Tailwind v4**: dev (`bun run dev`) and prod build
  (`bun run build`) succeed. Placeholder homepage renders the wallrus
  h1; Playwright smoke verifies.
- **Docker**: `docker build -t wallrus .` produces an `oven/bun:1-slim`
  runtime image, runs as non-root, mounts `/data/wallrus`. Healthcheck
  points at `/healthz` (which does not exist yet — 002 will add it).
- **User docs site** is live at <https://tigorlazuardi.github.io/wallrus/>
  with /en/ and /id/ branches, 15 pages, Pagefind search index, GitHub
  Pages auto-deploy on every push that touches `docs/**`.
- **Telemetry**: SDK initialised at boot; `getLogger()` emits stderr
  JSON; OTLP export active when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- **/otlp browser proxy** + **/api/v1/otel/discover** routes mounted.
  Auth gate driven by `WALLRUS_OTEL_FRONTEND`.

What's stubbed (intentionally — fill in subsequent slices):

- `src/hooks.server.ts` sets `locals.user = null` and lets everything
  through. No real auth gate yet (`002` won't add it either; auth is
  its own slice).
- `src/lib/server/scheduler/{cron,executor}.ts` are placeholder modules.
- `src/lib/server/sources/_registry.ts` is empty.
- `src/lib/server/service/devices/ListDevices.ts` throws
  `unimplemented`. Used as the codestyle reference for future services.

## Resume here

→ Open `plans/002-http-integration/IMPLEMENTATION.md` and follow its
"Resume here" section. The 002 slice wires Bun.serve to host SvelteKit
**and** the scheduler tick in the same process, and adds `/healthz`.

## Gotchas / deferred

- `bunfig.toml` scopes `bun test` to `./src` only — the Playwright
  spec in `tests/e2e/` is run via `bun run test:e2e`. Don't break this
  by moving tests around without updating the config.
- Drizzle-kit's snapshot files under `drizzle/migrations/meta/` MUST be
  committed alongside the SQL — they're how the journal tracks
  applied migrations. Don't gitignore.
- `actions/upload-pages-artifact@v4` transitively pulls a Node 20 action
  deprecated June 2026. Wait for upstream bump; nothing to do now.
- Pre-existing 4 ESLint warnings (placeholder mixin scaffolds in
  `service/base.ts` + `service/devices/ListDevices.ts`) — they vanish
  when the services are implemented. Leave for now.
- The OTLP proxy auth gate reads `locals.user` set by `hooks.server.ts`.
  Today's hook always sets `null`, so when `WALLRUS_AUTH_ENABLE=true`
  AND `WALLRUS_OTEL_FRONTEND=enable` AND no real user exists, the proxy
  returns 401. This becomes meaningful once `003-auth` lands.

## Commits in this slice

```
9a1964a docs: lock MVP scope, architecture, and Claude rules
22e8fb5 chore: add code quality tooling (lint, format, hooks, tests)
955d571 feat: scaffold daemon, schema, Docker deployment
63d0a59 docs: add Astro Starlight user guide + GitHub Pages deploy
5bd53a1 chore(deps): upgrade TypeScript 6, Astro 6, Starlight 0.39
2d1f49a docs(rules): telemetry.md + replace console.* with getLogger
3216437 feat(telemetry): wire initSDK at bootstrap, adopt OTel-standard env
ddf8843 docs: rewrite GitHub URLs to tigorlazuardi owner
36f7879 feat(otlp): browser-telemetry proxy + discovery endpoint
```
