# 016 — Mobile shell — tasks

> **Status: deferred / not-started.** Depends on slice 015 being
> **done** first. Do NOT pick up these tasks until the user
> greenlights mobile work explicitly.

## Phase 4 — dual adapter build

- [ ] `bun add -d @sveltejs/adapter-static`
- [ ] `svelte.config.js` — adapter switch on `WALLRUS_ADAPTER === "static"`, static output to `build-mobile/` with SPA fallback
- [ ] `package.json` — `"build:mobile": "WALLRUS_ADAPTER=static bun --bun vite build"`
- [ ] `bun run build` (web) + `bun run build:mobile` (static) both succeed locally
- [ ] CI workflow runs both builds; static build failure breaks the build

## Phase 5 — Capacitor scaffold

- [ ] `bun add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/preferences`
- [ ] `bun x cap init wallrus io.wallrus.app --web-dir=build-mobile`
- [ ] `bun x cap add android`
- [ ] `bun x cap add ios`
- [ ] `mobile/src/app.ts` — boot: detect `Capacitor.isNativePlatform()`, read `api_base` from preferences → `set_api_base()` → continue; else navigate to `/setup`
- [ ] `mobile/src/app.ts` — same for `auth_token`: read → attach to fetcher; if absent, login flow navigates and saves
- [ ] `src/routes/setup/+page.svelte` — text input + "Test connection" button (`/healthz` check), gated by `Capacitor.isNativePlatform()` else 404
- [ ] `mobile/src/screens/` — thin containers for screens that diverge from web routes (most don't; webview renders SvelteKit routes as-is)
- [ ] `mobile/capacitor.config.ts` — server CSP permits `capacitor://localhost`
- [ ] `bun x cap sync` succeeds
- [ ] Android emulator launches; loads `/setup`; setup flow saves URL; gallery loads
- [ ] iOS simulator same flow

## Phase 6 — native wallpaper plugin

- [ ] `mobile/plugins/wallpaper/src/index.ts` — `WallpaperPlugin` interface + `registerPlugin("Wallpaper")`
- [ ] `mobile/plugins/wallpaper/android/WallpaperPlugin.kt` — `WallpaperManager.setBitmap` with `FLAG_SYSTEM | FLAG_LOCK` per `target`
- [ ] `mobile/android/app/src/main/AndroidManifest.xml` — declare `SET_WALLPAPER` permission
- [ ] Android plugin registration in `MainActivity.java`
- [ ] `mobile/plugins/wallpaper/ios/WallpaperPlugin.swift` — save asset to Photos via `PHPhotoLibrary` + present `UIActivityViewController`
- [ ] iOS plugin registration in `AppDelegate.swift` / `Plugin.m`
- [ ] Wire "Set as wallpaper" button into image detail screen with target picker (Android) / explainer dialog (iOS)
- [ ] Native-side image download (OkHttp Android / URLSession iOS) — avoid base64 bridge crossing
- [ ] Android emulator verification: wallpaper actually changes
- [ ] iOS simulator verification: save + share-sheet appears, user can tap "Use as Wallpaper"

## Phase 7 — release wiring

- [ ] Android adaptive app icon + splash screen + signing keystore (gitignored, path via env var)
- [ ] iOS app icon set + splash + bundle ID + provisioning profile
- [ ] Decision: distribution path (self-hosted APK + TestFlight is the recommendation)
- [ ] If self-hosted APK: new endpoint `/api/v1/mobile/release/latest` returning `{ version, sha256, url, mandatory }`
- [ ] If self-hosted APK: boot-time version check in `mobile/src/app.ts` with in-app "update available" prompt
- [ ] `mobile/README.md` — build + sign + distribute instructions for both platforms
- [ ] First internal-distribution APK published + verified on real device
- [ ] First TestFlight build accepted by App Store Connect

## Verification gates

- [ ] `bun run check` clean (no regression)
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Phase 4: both adapter builds succeed; CI catches regressions on each
- [ ] Phase 5: emulator setup flow saves URL + loads gallery
- [ ] Phase 6: wallpaper actually changes on Android device/emulator
- [ ] Phase 6: iOS share-sheet flow verified by user
- [ ] Phase 7: APK installs and runs on stock Android; TestFlight accepts iOS build
- [ ] `lefthook` pre-commit + commit-msg pass at every commit

## Commit + push (one per phase)

- [ ] Phase 4: `feat(mobile-shell): dual adapter build (Bun web + static mobile)`
- [ ] Phase 5: `feat(mobile-shell): Capacitor scaffold + dynamic base URL setup screen`
- [ ] Phase 6: `feat(mobile-wallpaper): native WallpaperManager plugin (Android) + save-to-Photos (iOS)`
- [ ] Phase 7: `feat(mobile-release): Android signing + iOS provisioning + distribution wiring`
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated for `016-mobile-shell`
- [ ] Bookkeeping: `chore(plans): mark 016-mobile-shell done`
