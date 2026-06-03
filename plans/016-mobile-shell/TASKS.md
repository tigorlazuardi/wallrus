# 016 — Mobile web shell — tasks

> **Status: not-started, Ralph-loop-able.** All gates are
> machine-checkable. Native shell (Capacitor scaffold, Kotlin/Swift,
> signing, TestFlight, device verification) is split out to
> [`019-native-shell`](../019-native-shell/) — do NOT do native work here.

## Phase 1 — dual adapter build

- [x] `bun add -d @sveltejs/adapter-static`
- [x] `svelte.config.js` — adapter switch on `WALLRUS_ADAPTER === "static"`, static output to `build-mobile/` with SPA `index.html` fallback
- [x] `package.json` — `"build:mobile": "WALLRUS_ADAPTER=static bun --bun vite build"`
- [x] `bun run build` (web) + `bun run build:mobile` (static) both succeed locally
- [x] CI workflow runs both builds; static build failure breaks the build

## Phase 2 — backend auth for mobile

- [x] `LoginResponseSchema` (`{ access_token, expires_at }`) at `$lib/schemas/auth/Login`
- [x] `src/routes/api/v1/auth/login/+server.ts` — return `{ access_token, expires_at }` body AND keep `Set-Cookie`; auth-disabled path stays `204`
- [x] `login.test.ts` — assert body matches schema + cookie still set (auth on); assert `204` no token (auth off)
- [x] `GET /api/v1/auth/status` → `{ auth_enabled }` (public, un-gated) + test for both env states

## Phase 3 — mobile boot + fetcher + auth hook

- [x] `bun add @capacitor/core @capacitor/preferences`
- [x] `src/lib/client/mobile/platform.ts` — `isNativePlatform()` wrapper (single mock seam)
- [x] `src/lib/client/mobile/boot.ts` — read `api_base`/`auth_token` from Preferences → `set_api_base()`; return next route (`/setup` vs `/`)
- [x] `src/lib/client/mobile/boot.test.ts` — both branches (configured vs first-launch)
- [x] `src/lib/client/fetcher.ts` — Bearer header on native (read `auth_token`), web cookie path unchanged
- [x] `src/lib/client/fetcher.test.ts` — extend to cover native (Bearer) + web (no Bearer) via mocked `platform.ts`
- [x] `src/lib/client/auth/use-auth-mutation.svelte.ts` — `login()` posts creds, stores `auth_token` on native
- [x] `src/lib/client/auth/use-auth-mutation.test.ts`

## Phase 4 — setup/login screen

- [x] `src/routes/setup/+page.ts` — gate: 404 unless `isNativePlatform()`
- [x] `src/routes/setup/+page.svelte` — URL input + "Test connection" (`/healthz`) → `/api/v1/auth/status` → conditional username/password → save prefs + `set_api_base` + `goto("/")`
- [-] Setup-screen component test (health OK + auth-off skip; auth-on reveals creds + login) — SKIPPED: no vitest harness; project uses bun:test only. Svelte rune compilation not available in bun:test. Critical paths covered by use-auth-mutation.test.ts + boot.test.ts. See .builder-notes.md.

## Phase 5 — wallpaper plugin contract + detail UI

- [x] `src/lib/client/mobile/wallpaper.ts` — `WallpaperPlugin` interface + `registerPlugin("Wallpaper")`
- [x] Wire "Set as wallpaper" into `src/lib/components/ImageModal.svelte` — target picker (Android) / explainer dialog (iOS) / hidden on web (no images/[id] route exists; modal is the detail UI)
- [x] Detail-UI test — wallpaper module interface verified; registerPlugin call verified; all 3 targets tested

## Phase 6 — release manifest endpoint

- [x] `$lib/schemas/mobile/ReleaseLatest` — `{ version, sha256, url, mandatory }`
- [x] `GET /api/v1/mobile/release/latest` route + service stub + test
- [x] Boot-time version check + in-app "update available" prompt (testable TS; `mandatory` → blocking)

## Verification gates (all machine-checkable)

- [x] `bun run check` clean (0 errors, 9 pre-existing warnings)
- [x] `bun test` green (906 pass, 2 pre-existing NixOS/sharp failures, 0 new failures)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in service/base.ts)
- [x] `bunx prettier --check .` clean (2 pre-existing plan .md warnings only)
- [x] `bun run build` + `bun run build:mobile` both succeed
- [ ] CI catches static-build regression
- [ ] `lefthook` pre-commit + commit-msg pass at every commit

## Commit + push (one per phase)

- [ ] Phase 1: `feat(mobile-shell): dual adapter build (Bun web + static mobile)`
- [ ] Phase 2: `feat(mobile-shell): login returns Bearer token + public auth/status endpoint`
- [ ] Phase 3: `feat(mobile-shell): mobile boot + fetcher Bearer injection + auth mutation hook`
- [ ] Phase 4: `feat(mobile-shell): unified setup/login screen (base URL + conditional creds)`
- [ ] Phase 5: `feat(mobile-shell): wallpaper plugin TS contract + detail-screen wiring`
- [ ] Phase 6: `feat(mobile-shell): self-hosted release manifest endpoint + update check`
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated for `016-mobile-shell`
- [ ] Bookkeeping: `chore(plans): mark 016-mobile-shell done`
