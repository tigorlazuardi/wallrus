# 016 — Mobile web shell (Ralph-loop-able): dual adapter + setup/login + plugin contract

## Status

**done** — All 6 phases landed and pushed. Every gate in this slice is
machine-checkable (`bun run check` / `bun test` / `eslint` / `prettier` /
both adapter builds), so the loop can build AND close it without a
device, emulator, native toolchain, or human in the loop.

The **native** half (Capacitor scaffold, Kotlin/Swift plugins, signing,
TestFlight, on-device verification) is split out to
[`019-native-shell`](../019-native-shell/) because its gates are
human-driven and cannot be green-gated by an automated loop.

Depends on [`015-shared-ui`](../015-shared-ui/) — **done**.

## Goal

Build everything mobile-shaped that lives **inside the SvelteKit `src/`
tree** and verifies with automated gates: the static (SPA) adapter build,
a Bearer-token login path on the daemon, a unified setup/login screen,
testable mobile-boot logic, Bearer injection in `fetcher`, a release-
manifest endpoint, and the "Set as wallpaper" UI wired against a
**mocked** plugin interface. After this slice the app is fully
mobile-ready in pure TS/Svelte; slice 019 only has to wrap it natively.

## Decisions (pre-baked)

### Builds on slice 015 (done)

- Pages load via `+page.ts` universal load → `/api/v1/*`.
- Components are pure presenters; data via `$lib/client/<domain>/use-*`.
- `$lib/client/config.ts` (`api_base()` / `set_api_base()`) and
  `$lib/client/fetcher.ts` (`apiFetch`) already exist and are waiting on
  this slice — see `src/lib/client/config.ts`, `src/lib/client/fetcher.ts`.

### All mobile TS lives under `src/lib/`, NOT a top-level `mobile/`

The Capacitor wrapper folder (`mobile/`) is deferred to 019. Everything
this slice writes goes inside the SvelteKit `src/` tree so it is part of
the normal build + `bun test` surface and resolves `$lib/*` aliases
cleanly. This sidesteps the old "schemas import from mobile-only code"
gotcha entirely — there is no out-of-build code in this slice.

```
src/lib/client/mobile/
  boot.ts            # pure, testable: resolve api_base + token from Preferences
  boot.test.ts
  wallpaper.ts       # WallpaperPlugin TS interface + registerPlugin("Wallpaper")
  platform.ts        # isNativePlatform() wrapper (single mock seam)
src/lib/client/auth/
  use-auth-mutation.svelte.ts   # login() → stores Bearer on native
  use-auth-mutation.test.ts
src/routes/setup/
  +page.svelte       # unified setup + login screen
  +page.ts           # gated; 404 on web (non-native)
```

### Single repo, NO monorepo

Capacitor (in 019) goes in a top-level `mobile/` subfolder pointing at
the static build via `webDir`. No Bun workspaces, no Turborepo. Recorded
in chat: solo dev, single-user homelab.

### Dual adapter build

```js
// svelte.config.js
const useStatic = process.env.WALLRUS_ADAPTER === "static"
adapter: useStatic
  ? adapterStatic({ fallback: "index.html", pages: "build-mobile", assets: "build-mobile" })
  : adapterBun()
```

```json
// package.json
"build:mobile": "WALLRUS_ADAPTER=static bun --bun vite build"
```

### Backend: login returns a Bearer token (in addition to the cookie)

`api.md` already specifies `POST /api/v1/auth/login` → `{ access_token,
expires_at }`, but the current handler only returns `204` + sets the
cookie (`src/routes/api/v1/auth/login/+server.ts:90-92`). Cookies are
browser-only; the Capacitor webview needs a Bearer token. This slice
makes the endpoint **return the signed JWT + expiry in the body** while
keeping the cookie for web. No new auth model — same JWT, same secret,
same rate-limit. Add `LoginResponseSchema` next to the existing
`LoginRequestSchema` at `$lib/schemas/auth/Login`.

- Gate: route test imports the handler, posts valid creds, asserts body
  matches `LoginResponseSchema` AND the `Set-Cookie` header is still set.
- Auth-disabled path unchanged: still `204`, no token.

### Auth-state discovery for the setup screen

The setup screen must know whether the daemon requires credentials.
Add a tiny **public** endpoint `GET /api/v1/auth/status` →
`{ auth_enabled: boolean }` (un-gated, like `/healthz`). The setup
screen calls it after a successful health check and only then reveals the
username/password fields.

- Gate: route test asserts `auth_enabled` reflects `WALLRUS_AUTH_ENABLE`
  for both true/false env states.

### Unified setup + login screen (one screen)

`/setup` (gated by native platform; `+page.ts` returns 404 on web):

1. Text input for daemon URL + **"Test connection"** →
   `fetch(${url}/healthz)` expects 200.
2. On health OK → `fetch(${url}/api/v1/auth/status)`:
   - `auth_enabled: false` → save base URL, `set_api_base(url)`, `goto("/")`.
   - `auth_enabled: true` → reveal **username + password** (optional only
     in the sense that they're hidden when auth is off; required when on)
     → submit through `useAuthMutation().login()` → store Bearer →
     save base URL → `goto("/")`.
3. Same screen handles re-config later (moved daemon, new server).

Persistence via `@capacitor/preferences` keys `api_base` + `auth_token`.

### Token storage + Bearer injection

- `@capacitor/preferences` holds `api_base` and `auth_token`.
- `fetcher.ts` gains a Bearer header on native only:
  ```ts
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key: "auth_token" })
    if (value) headers.set("Authorization", `Bearer ${value}`)
  }
  ```
  `isNativePlatform()` is wrapped in `platform.ts` so `bun test` can mock
  the single seam and exercise both branches. Web path is unchanged
  (cookie), so existing `fetcher.test.ts` stays green.
- `@capacitor/preferences` is SharedPreferences / NSUserDefaults — not
  secure storage. Acceptable for homelab; swap to
  `@capacitor-community/secure-storage` if ever public.

### Capacitor dependencies — runtime libs only in this slice

`bun add @capacitor/core @capacitor/preferences`. These are the libs the
boot/fetcher/wallpaper TS imports; they typecheck and bundle in the static
build with no native toolchain. The CLI + platform packages
(`@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`) and all
`cap init/add/sync` scaffolding are deferred to 019.

### Native wallpaper plugin — TS interface only (impl in 019)

```ts
// src/lib/client/mobile/wallpaper.ts
export interface WallpaperPlugin {
  setWallpaper(opts: {
    imageUrl: string
    target: "home" | "lock" | "both" // Android only
  }): Promise<{ success: boolean; note?: string }>
}
export const Wallpaper = registerPlugin<WallpaperPlugin>("Wallpaper")
```

The "Set as wallpaper" UI is wired into the image detail screen against
this interface; in `bun test` the plugin is mocked. The Kotlin/Swift
implementations land in 019.

- Android (019): `WallpaperManager.setBitmap(..., FLAG_SYSTEM | FLAG_LOCK)`.
- iOS (019): save-to-Photos + share-sheet (Apple forbids programmatic
  set). Returns `{ success: true, note: "saved-to-photos-share-required" }`.

### "Set as wallpaper" UI

Wired into `src/routes/(app)/images/[id]/+page.svelte`:

- Native + Android: target picker (Home / Lock / Both) → `Wallpaper.setWallpaper` → toast.
- Native + iOS: explainer dialog (save + share) → `Wallpaper.setWallpaper`.
- Web (non-native): button hidden.

Gate: component test renders the detail presenter with the platform seam
mocked native, asserts the picker/dialog appears and calls the mocked
plugin with the right `target`.

### Self-hosted release manifest endpoint

`GET /api/v1/mobile/release/latest` → `{ version, sha256, url, mandatory }`
(thin route + Zod schema + service stub reading from env/config). Boot-time
version check + in-app "update available" prompt land here as testable TS;
actually publishing the APK is 019.

- Gate: route test asserts the response matches the schema.

### Out of scope (this slice → moved to 019 or post-MVP)

- All native code, Capacitor scaffold, signing, store/TestFlight (→ 019).
- Public store listings, offline cache, push, multi-daemon, widgets,
  Tauri path (post-MVP, per chat).

## State at start

- Slice 015 done; `config.ts` + `fetcher.ts` present, awaiting this slice.
- Single adapter (Bun) in `svelte.config.js`.
- Login endpoint returns `204` + cookie only — **no Bearer body yet**.
- No `/setup` route, no `auth/status` endpoint, no mobile boot module, no
  release-manifest endpoint, no auth mutation hook.

## Resume here

### Phase 1 — dual adapter build

1. `bun add -d @sveltejs/adapter-static`.
2. `svelte.config.js`: adapter switch on `WALLRUS_ADAPTER === "static"`,
   SPA fallback to `build-mobile/`.
3. `package.json`: add `"build:mobile"`.
4. Verify `bun run build` + `bun run build:mobile` both succeed.
5. CI: add `build:mobile` step alongside the web build.

### Phase 2 — backend auth for mobile

6. `LoginResponseSchema` at `$lib/schemas/auth/Login`.
7. Login handler returns `{ access_token, expires_at }` body + keeps
   cookie; auth-disabled path still `204`. Update `login.test.ts`.
8. `GET /api/v1/auth/status` → `{ auth_enabled }` (public). Add test.

### Phase 3 — mobile boot + fetcher + auth hook

9. `bun add @capacitor/core @capacitor/preferences`.
10. `src/lib/client/mobile/platform.ts` — `isNativePlatform()` seam.
11. `src/lib/client/mobile/boot.ts` (+ test) — read prefs → `set_api_base`,
    return next-route signal (`"/setup"` vs `"/"`).
12. `fetcher.ts` — Bearer injection on native; keep web cookie path; extend
    `fetcher.test.ts` to cover both branches via mocked `platform.ts`.
13. `src/lib/client/auth/use-auth-mutation.svelte.ts` (+ test) — `login()`
    posts creds, stores `auth_token` on native.

### Phase 4 — setup/login screen

14. `src/routes/setup/+page.ts` — gate: 404 unless native.
15. `src/routes/setup/+page.svelte` — URL input + Test connection →
    `auth/status` → conditional creds → save + navigate.

### Phase 5 — wallpaper plugin contract + detail UI

16. `src/lib/client/mobile/wallpaper.ts` — interface + `registerPlugin`.
17. Wire "Set as wallpaper" into
    `src/routes/(app)/images/[id]/+page.svelte` (target picker / iOS
    explainer), plugin mocked in tests.

### Phase 6 — release manifest endpoint

18. `$lib/schemas/mobile/ReleaseLatest` schema.
19. `GET /api/v1/mobile/release/latest` route + service stub + test.
20. Boot-time version check + "update available" prompt (testable TS).

## Verification gates (all machine-checkable)

- [ ] `bun run check` clean
- [ ] `bun test` green (boot, fetcher both branches, auth mutation, login
      body+cookie, auth/status, release manifest, detail-UI plugin call)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `bun run build` (web) AND `bun run build:mobile` (static) both succeed
- [ ] CI runs both builds; static failure breaks the build
- [ ] `lefthook` pre-commit + commit-msg pass at every commit

## Done definition

Suggested commit chain (one per phase):

```
feat(mobile-shell): dual adapter build (Bun web + static mobile)
feat(mobile-shell): login returns Bearer token + public auth/status endpoint
feat(mobile-shell): mobile boot + fetcher Bearer injection + auth mutation hook
feat(mobile-shell): unified setup/login screen (base URL + conditional creds)
feat(mobile-shell): wallpaper plugin TS contract + detail-screen wiring
feat(mobile-shell): self-hosted release manifest endpoint + update check
chore(plans): mark 016-mobile-shell done
```

Closes when all six phases land green and pushed. No device/native step
gates this slice — that is 019's job.

## Gotchas / Deferred

- **Native is 019, not here.** This slice must NOT run `cap init/add/sync`
  or write Kotlin/Swift. Keep every artifact inside `src/lib/` so gates
  stay automated.
- **Cookie vs Bearer**: web keeps the cookie; native uses Bearer. The
  login endpoint serves both — don't remove the cookie path.
- **iOS wallpaper limitation** surfaces in the UI copy now (explainer
  dialog), even though the native impl is 019.
- **`@capacitor/preferences` ≠ secure** — acceptable for homelab.
- **SSE in Capacitor**: tested-OK on Android WebView ≥116 / iOS WKWebView;
  no polyfill (relevant in 019, noted here for continuity).
- **Update mandatory flag**: `mandatory: true` in the release manifest is
  surfaced as a blocking prompt; wiring is testable TS here, enforcement
  on the native side is 019.
