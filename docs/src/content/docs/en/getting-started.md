---
title: Getting started
description: What wallrus is, what it does, and what you'll set up.
---

wallrus is a small daemon you run on your own machine. It periodically pulls
wallpapers from the sources you configure (Reddit subreddits, Booru sites),
applies per-device filters (resolution, aspect ratio, tags, NSFW mode), and
serves the collection through a WebUI and a JSON API.

## What you need

- A machine that can run [Docker](https://docs.docker.com/get-docker/) — or
  alternatively, a Bun runtime if you'd rather run it bare-metal.
- 1+ GB of free disk for the SQLite database, thumbnails, and the collected
  images themselves.
- Optional: a reverse proxy (Authelia, Tailscale, Caddy, …) if you want
  authentication handled upstream — wallrus also ships a simple built-in auth.

## Next steps

1. [Install](./install/) — the Docker quick-start or the bare-metal route.
2. [Environment variables](../configuration/env/) — full env reference.
3. [Auth](../configuration/auth/) — built-in vs reverse-proxy.
4. [Docker](../configuration/docker/) — compose, volumes, healthchecks.

## What wallrus is not

- Not a wallpaper-setter. A future mobile/native client will read the API and
  apply wallpapers on your device. wallrus itself only stores and serves.
- Not multi-user. One shared credential, configured via env. For richer auth,
  put a reverse proxy in front.
- Not a CDN. It's a single-machine homelab daemon.
