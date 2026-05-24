# 001 — Foundation: tasks

All done. Kept here as a record of what closed this slice.

## Scope + rules

- [x] Lock `engineering/SCOPE.md` (what + why, MVP boundary)
- [x] Lock `engineering/ARCHITECTURE.md` (how: layers, schema, pipeline, picks)
- [x] Six path-scoped Claude rules: `scope.md`, `bun.md`, `database.md`, `frontend.md`, `api.md`, `service.md`, `sources.md`
- [x] Rule index in `CLAUDE.md`
- [x] User-docs rule (`.claude/rules/user-docs.md`) with broad `paths:` over env / Docker / deploy workflow

## Tooling

- [x] Prettier (tabs, 100-width) + svelte/tailwind plugins
- [x] ESLint flat config (typescript-eslint + svelte plugin + prettier off)
- [x] `no-console` rule under `src/**` (test files exempt)
- [x] Lefthook: pre-commit gitleaks/format/lint/typecheck/test, commit-msg commitlint
- [x] Commitlint conventional commits
- [x] Playwright config (`playwright.config.ts`, smoke spec under `tests/e2e/`)
- [x] `bun test` scoped to `./src` via `bunfig.toml`
- [x] Package scripts: `dev`, `build`, `serve`, `test`, `test:watch`, `test:e2e`, `lint`, `format`, `check`, `db:generate`, `db:studio`

## Scaffold

- [x] SvelteKit + svelte-adapter-bun + Vite + Tailwind v4
- [x] App skeleton (`app.html`, `app.d.ts`, `app.css`, `hooks.server.ts` stub, root `+layout.svelte`, placeholder `+page.svelte`)
- [x] Commander CLI entry (`src/cli.ts`) with `serve` subcommand
- [x] `src/lib/server/bootstrap.ts` orchestrator
- [x] `src/lib/server/env.ts` Zod env parser with lazy `env()` singleton
- [x] `src/lib/server/telemetry.ts` curated re-export
- [x] `src/lib/server/fs/{path,link,perms}.ts` helpers
- [x] `src/lib/server/scheduler/{cron,queue,executor}.ts` stubs
- [x] `src/lib/server/sources/{_types,_registry}.ts` (registry empty)
- [x] Service mixin pattern reference (`src/lib/server/service/{base,index,devices/index,devices/ListDevices}.ts`)
- [x] Schema split: `src/lib/schemas/<domain>/<Op>.ts` (universal Zod) vs `src/lib/server/service/<domain>/<Op>.ts` (server-only op)
- [x] First test: `src/lib/server/service/devices/ListDevices.test.ts`

## DB

- [x] `src/lib/server/db/schema.ts` — 9 tables + GENERATED VIRTUAL + CHECK + customType JSON + reverse junction indexes
- [x] `src/lib/server/db/client.ts` — bun:sqlite + drizzle, PRAGMAs (incl. WAL) reapplied on every connection
- [x] `src/lib/server/db/migrate.ts` — drizzle migrator wrapper
- [x] `drizzle.config.ts` — strict, verbose, output to `drizzle/migrations/`
- [x] `0000_initial_schema.sql` — generated then patched (STRICT, COLLATE NOCASE, DEFAULT 1)
- [x] `0001_fts5_search_text.sql` — custom: virtual table + ai/ad/au triggers
- [x] Auto-migrate at every `serve` boot
- [x] Crash-recovery sweep (`status=running` → `failed` + `daemon_crash`)

## Docker + deploy

- [x] Multi-stage `Dockerfile` (deps / build / runtime), non-root, `/data/wallrus` 0700, VOLUME, EXPOSE 5173
- [x] `.dockerignore` excludes secrets / build artifacts
- [x] `docker-compose.yml` reference with `OTEL_EXPORTER_OTLP_ENDPOINT` placeholder
- [x] User docs site (`docs/`) Astro Starlight, bilingual en/id, sidebar configured
- [x] GitHub Actions `deploy-docs.yml` — Bun setup → install → build → upload-pages-artifact → deploy-pages
- [x] GitHub Pages enabled via `gh api`, site live at `https://tigorlazuardi.github.io/wallrus/`

## Telemetry

- [x] `initSDK()` wired at boot from `bootstrap.ts`, threaded into `Runtime`
- [x] `setDefaultLogger(sdk.logger)` so `getLogger()` outside contexts hits the SDK instance
- [x] OTel-standard env names: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_HEADERS`
- [x] Helper `parse_resource_attributes()` for `k=v,k=v` format with default `service.namespace=homelab`
- [x] `parse_otlp_headers()` splits on FIRST `=` per pair so JWTs survive
- [x] Replaced existing `console.*` calls with `getLogger()`
- [x] `.claude/rules/telemetry.md` covers logger, AppError, traced, withTrace, withQueryName, metrics-via-OTel-API

## OTLP browser proxy

- [x] `WALLRUS_OTEL_FRONTEND=enable|auth|disable` env (default `enable`)
- [x] `otel_frontend_posture(env)` helper computes `{ enabled, auth_required, mode }`
- [x] `POST /otlp/v1/[signal]` proxy with 1 MiB body cap, content-type pass-through, header injection
- [x] `GET /api/v1/otel/discover` (public) returns posture JSON
- [x] User docs `configuration/browser-telemetry.md` (en + id) + sidebar entry

## Plans directory

- [x] `plans/README.md` conventions
- [x] `plans/001-foundation/{IMPLEMENTATION,TASKS}.md` (this slice, retroactive)
- [x] `plans/002-http-integration/{IMPLEMENTATION,TASKS}.md` seeded for next session
- [ ] Rule pointer + CLAUDE.md mention so AI sessions discover `plans/`

## Out of scope for this slice (handled by later slices)

- HTTP serve loop, SvelteKit handler integration, `/healthz` → `002-http-integration`
- Real auth gate, login form, JWT issuance, cookie HMAC → `003-auth`
- Reddit + Booru source modules → `004-sources`
- Ingest pipeline executor + fanout + thumbnail → `005-ingest`
- Service implementations (devices, subscriptions, images, runs) + pagination helper → per-domain slices
- WebUI surfaces (gallery, device pages, subscription form, run dashboard) → per-surface slices
