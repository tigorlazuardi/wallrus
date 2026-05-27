# wallrus

A small self-hosted daemon that **collects wallpapers** for your homelab. It
periodically pulls images from the sources you configure (Reddit subreddits,
Booru sites), filters them per **device profile** (resolution, aspect ratio,
tags, NSFW mode), and serves the collection through a WebUI and a JSON API.

wallrus is **not** a wallpaper-setter — it stores and serves; a downstream
native/mobile client applies them. It's a single-machine homelab daemon, not a
CDN or multi-tenant service.

## Features

- **Scheduled collection** — per-subscription cron pulls from first-party
  sources (Reddit, Danbooru, Gelbooru, Safebooru, yande.re, Konachan).
- **Per-device filtering** — define devices (`phone`, `desktop-1440p`, `tv-4k`)
  with their own resolution, aspect-ratio, file-size, format, tag, and NSFW
  rules. One subscription fans out to many devices.
- **WebUI + API** — browse, search (FTS5), favorite, tag, soft-delete, and
  blacklist images; manage devices and subscriptions. API is ready for a future
  mobile client.
- **Sync-friendly storage** — local filesystem + SQLite, stable descriptive
  filenames, per-device directories (great for syncthing/rsync).
- **Auth your way** — simple built-in username/password, or disable it and let
  a reverse proxy (Authelia, Tailscale, …) handle identity upstream.

## Documentation

**Full user guide → <https://tigorlazuardi.github.io/wallrus/>**

The guide covers install (Docker and bare-metal), every environment variable,
auth modes, Docker compose layout, and browser telemetry — in both English and
Bahasa Indonesia.

## Quick start (Docker)

```sh
docker run -d \
  --name wallrus \
  -p 5173:5173 \
  -v wallrus-data:/data/wallrus \
  ghcr.io/tigorlazuardi/wallrus:latest
```

Then open <http://localhost:5173>. See the
[install guide](https://tigorlazuardi.github.io/wallrus/en/install/) for
compose, volumes, auth, and bare-metal setup.

## Stack

Bun · SvelteKit (Svelte 5 runes) · Tailwind v4 · shadcn-svelte · SQLite
(`bun:sqlite`) · Drizzle ORM. Entrypoint is a commander CLI — `wallrus serve`
starts the HTTP + scheduler daemon.

## Contributing

Sources are **first-party** modules under `src/lib/server/sources/<slug>.ts` —
there's no plugin system, so adding a source is a PR. Design and scope docs live
in [`engineering/SCOPE.md`](engineering/SCOPE.md) and
[`engineering/ARCHITECTURE.md`](engineering/ARCHITECTURE.md); read those before
proposing features or refactors.
