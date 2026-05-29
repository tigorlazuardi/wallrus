# 019 — Native shell — tasks

> **Status: deferred / human-gated. NOT for Ralph loop.** Gates require
> a native toolchain (Android SDK, Xcode/macOS), an emulator or device,
> and human sign-off (TestFlight, on-device wallpaper change). Do NOT
> drive with `/ralph-loop`. Depends on `016-mobile-shell` being **done**.

## Phase 1 — Capacitor scaffold

- [ ] `bun add @capacitor/cli @capacitor/android @capacitor/ios`
- [ ] `bun x cap init wallrus io.wallrus.app --web-dir=build-mobile`
- [ ] `bun x cap add android`
- [ ] `bun x cap add ios`
- [ ] `mobile/capacitor.config.ts` — server CSP permits `capacitor://localhost`
- [ ] `bun x cap sync` succeeds
- [ ] Android emulator launches, loads `/setup`, setup flow saves URL, gallery loads
- [ ] iOS simulator same flow

## Phase 2 — native wallpaper plugin

- [ ] `mobile/plugins/wallpaper/android/WallpaperPlugin.kt` — `WallpaperManager.setBitmap` with `FLAG_SYSTEM | FLAG_LOCK` per `target`; OkHttp native download
- [ ] `mobile/android/app/src/main/AndroidManifest.xml` — declare `SET_WALLPAPER`
- [ ] Android plugin registration in `MainActivity.java`
- [ ] `mobile/plugins/wallpaper/ios/WallpaperPlugin.swift` — save to Photos via `PHPhotoLibrary` + present `UIActivityViewController`; URLSession native download
- [ ] iOS plugin registration in `AppDelegate.swift` / `Plugin.m`
- [ ] Android emulator/device: wallpaper actually changes
- [ ] iOS simulator/device: save + share-sheet appears, user taps "Use as Wallpaper"

## Phase 3 — release wiring

- [ ] Android adaptive icon + splash + signing keystore (gitignored, env-driven path/passwords)
- [ ] iOS app icon set + splash + bundle ID + provisioning profile
- [ ] Build signed APK; publish to the `/api/v1/mobile/release/latest` source
- [ ] TestFlight build uploaded + accepted by App Store Connect
- [ ] `mobile/README.md` — build + sign + distribute for both platforms
- [ ] First internal-distribution APK verified on real device
- [ ] First TestFlight build accepted

## Verification gates (human / native — NOT loop-checkable)

- [ ] `bun x cap sync` succeeds
- [ ] Wallpaper actually changes on Android device/emulator
- [ ] iOS share-sheet flow verified by user
- [ ] Signed APK installs and runs on stock Android
- [ ] TestFlight accepts the iOS build
- [ ] `lefthook` pre-commit + commit-msg pass on any committed TS/config

## Commit + push (one per phase)

- [ ] Phase 1: `feat(native-shell): Capacitor scaffold (Android + iOS) over static build`
- [ ] Phase 2: `feat(native-wallpaper): WallpaperManager plugin (Android) + save-to-Photos (iOS)`
- [ ] Phase 3: `feat(native-release): Android signing + iOS provisioning + distribution wiring`
- [ ] `Status: done` in IMPLEMENTATION.md (set by a human — the loop never closes this)
- [ ] README index updated for `019-native-shell`
- [ ] Bookkeeping: `chore(plans): mark 019-native-shell done`
