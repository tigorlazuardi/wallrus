# wallrus

Personal/homelab wallpaper collector daemon. Bun + SvelteKit (Svelte 5) + Tailwind v4 + shadcn-svelte + SQLite + Drizzle. Pulls images from configured first-party sources (Reddit, Booru, …) on cron, filters per device profile, serves via WebUI + API.

This file is intentionally a **light index**. Detailed guidance lives in path-scoped rules under `.claude/rules/` and the canonical docs at `engineering/SCOPE.md` + `engineering/ARCHITECTURE.md`. Read what's relevant to the task at hand — do not assume the rules below are already loaded.

## Where to look

| You're working on…                                                                                                               | Rule auto-loads (path-scoped)                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**`, `engineering/**`, `scripts/**`, `package.json`                                                                         | `.claude/rules/scope.md` — scope, domain model, what-and-why                                                                                                        |
| TS / JS / HTML / `package.json` / `bun.lock`                                                                                     | `.claude/rules/bun.md` — Bun built-ins, no-Node rules                                                                                                               |
| `src/lib/server/db/**`, `drizzle/**`, `migrations/**`, `schema.ts`                                                               | `.claude/rules/database.md` — STRICT, CHECK, json_valid, UUIDv7, time/\_ms, junction reverse indexes, upsert + RETURNING                                            |
| `src/routes/**`, `src/lib/components/**`, `**/*.svelte`, `tailwind.config.*`                                                     | `.claude/rules/frontend.md` — Svelte 5 runes, Tailwind v4, shadcn, theme tokens, glass chrome, masonry, NSFW, SSE client                                            |
| `src/routes/api/**`, `src/hooks.server.ts`                                                                                       | `.claude/rules/api.md` — pagination contract, auth gates, Zod boundary, error shape                                                                                 |
| `src/lib/server/service/**` or `src/lib/schemas/**`                                                                              | `.claude/rules/service.md` — mixin codestyle, schema split, all business logic, no auth/HTTP awareness                                                              |
| `src/lib/server/sources/**`                                                                                                      | `.claude/rules/sources.md` — SourceItem contract, async generator, SourceContext, no FS/DB/env access                                                               |
| `src/lib/server/**`, `src/hooks.server.ts`, `src/cli.ts`, route server files                                                     | `.claude/rules/telemetry.md` — `getLogger()` replaces `console.*`, `AppError` for throws, `@traced` / `withTrace` / `withQueryName` for spans, OTel API for metrics |
| `docs/**`, `src/lib/server/env.ts`, `Dockerfile`, `docker-compose.yml`, deploy workflow                                          | `.claude/rules/user-docs.md` — Astro Starlight user guide; keep env / Docker / deploy in sync, both `en` + `id` locales                                             |
| Anything that looks like new scope (new source kind, plugin/extensibility, new processing step, auth model, retention policy, …) | `engineering/SCOPE.md` — confirm before implementing                                                                                                                |
| Implementation / refactor — directory layout, schema, pipeline, scheduler, HTTP routing, FS layout, bootstrap, source contract   | `engineering/ARCHITECTURE.md` — the technical design                                                                                                                |

## Project layout (high level)

- `src/lib/server/service/*` — **all business logic** (server-only operations). SvelteKit server routes and API endpoints are thin wrappers calling services.
- `src/lib/schemas/*` — **universal wire contracts** (Zod schemas + DTO types). Importable from both server and client. Mirrors the operation tree: each operation file has a same-named sibling here.
- `src/lib/server/sources/<slug>.ts` — first-party source modules (Reddit, Booru, …). One file per source. **No plugin system** — adding a new source = a PR.
- `src/lib/server/db/*` — Drizzle schema + client + migration runner.
- `src/routes/*` — SvelteKit pages and `/api/v1/*` endpoints.
- `drizzle/migrations/*` — hand-written SQL migrations.
- `engineering/SCOPE.md` — single source of truth for scope (what + why).
- `engineering/ARCHITECTURE.md` — technical design (how).
- `docs/` — **user-facing** Astro Starlight site (setup, env, Docker guides), deployed to GitHub Pages. Keep in sync when user-visible config changes — see `.claude/rules/user-docs.md`.
- `.claude/rules/` — path-scoped rules loaded on demand.

## House rules

- The entrypoint is a **commander CLI**, not a direct HTTP server. `wallrus serve` starts the daemon.
- All PKs are **UUIDv7**. Images soft-delete (`deleted_at`), never hard-delete in MVP.
- Every list query MUST end with `, id` as the deterministic tie-breaker.
- If a task implies expanding scope, surface it and confirm against `engineering/SCOPE.md` first.
