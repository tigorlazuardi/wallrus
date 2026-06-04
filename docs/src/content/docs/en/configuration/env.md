---
title: Environment variables
description: Every env var wallrus reads, what it defaults to, and what it gates.
---

This is the **single canonical list** of every environment variable wallrus
reads. The source of truth is `src/lib/server/env.ts` in the repo — when
that file changes, this page changes in lockstep (both locales).

## Required when auth is enabled

These are required only when `WALLRUS_AUTH_ENABLE=true`. The default is
`false` — fresh installs are unauthenticated, on the assumption that a
reverse proxy in front of wallrus is doing the auth. Set
`WALLRUS_AUTH_ENABLE=true` to make wallrus enforce its own auth, in which
case all three vars below become mandatory.

| Variable                | Required | Default | Description                                                                                                                  |
| ----------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `WALLRUS_USERNAME`      | yes (if auth on) | —       | Single shared username for the WebUI and the JSON API.                                                                       |
| `WALLRUS_PASSWORD`      | yes (if auth on) | —       | Single shared password. Comparisons are timing-safe.                                                                         |
| `WALLRUS_AUTH_SECRET`   | yes (if auth on) | —       | At least 32 bytes of entropy. Drives the cookie HMAC marker AND the HS256 JWT signing key. Generate with `openssl rand -hex 32`. |

If `WALLRUS_AUTH_ENABLE=false`, all three are ignored.

## Always available

| Variable                | Default                | Description                                                                                                                          |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `WALLRUS_AUTH_ENABLE`   | `false`                | `"true"` or `"false"`. When `false` (the default), every route is public and the login endpoints return `404` / `410` — intended for reverse-proxy deployments. Set to `true` to make wallrus enforce its own auth (requires the three credential vars above). |
| `WALLRUS_DATA_DIR`      | `./data` (bare-metal) `\| /data/wallrus` (Docker image) | Directory holding the SQLite DB, thumbnails, staging files, and per-device subdirs. Daemon enforces `chmod 0700` on this dir. |
| `WALLRUS_LISTEN_ADDR`   | `0.0.0.0:5173`         | Host + port the HTTP server binds to.                                                                                                |
| `WALLRUS_MODE`          | `prod`                 | `"prod"` or `"dev"`. When `dev`, `wallrus serve` skips `Bun.serve` and exits after boot. Use `bun run dev` for local development (Vite-managed). The Docker image always runs in `prod` mode. |
| `WALLRUS_JWT_TTL_DAYS`  | `30`                   | Lifetime of issued JWTs (positive integer). No refresh tokens; re-login when expired.                                                |
| `WALLRUS_TRUST_PROXY`   | `false`                | `"true"` or `"false"`. When on, wallrus trusts `X-Forwarded-Proto` + `X-Forwarded-For` from the first hop only.                       |

## OpenTelemetry (standard OTel envs)

wallrus reads the **standard** OpenTelemetry env names. Set the same variables you'd use with any OTel-compliant SDK or collector.

| Variable                       | Default    | Description                                                                                                                                                |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | unset      | Base URL of an OpenTelemetry collector (e.g. `http://otel-collector:4318`). When unset, OTLP export is disabled and logs go to stderr only.                |
| `OTEL_SERVICE_NAME`            | `wallrus`  | Service name reported in every span / log / metric. Override if you run multiple wallrus instances behind one collector.                                   |
| `OTEL_RESOURCE_ATTRIBUTES`     | unset      | Comma-separated `key=value` pairs merged into the OpenTelemetry Resource (e.g. `deployment.environment=prod,service.instance.id=tv-rack`). Defaults include `service.namespace=homelab`. |
| `OTEL_EXPORTER_OTLP_HEADERS`   | unset      | Comma-separated `key=value` pairs (split on first `=` per pair, so JWTs survive). Injected by both the daemon's own exporter and the `/otlp` browser proxy. Use for `Authorization=Bearer …` or `x-api-key=…`. |

## Browser telemetry proxy

| Variable                  | Default  | Description |
| ------------------------- | -------- | ----------- |
| `WALLRUS_OTEL_FRONTEND`   | `enable` | One of `enable`, `auth`, `disable`. Controls the `/otlp` proxy that forwards browser OTel signals upstream. See [Browser telemetry](./browser-telemetry/) for the full posture matrix. |

## Container user (Docker)

These variables are read by the container entrypoint script — **not** by the wallrus app itself. They have no effect outside Docker.

| Variable | Default | Description                                                                                                                                              |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUID`   | `1000`  | Numeric user ID the daemon runs as. The entrypoint `chown`s `/data/wallrus` to this UID on startup and drops privileges before starting the daemon.     |
| `PGID`   | `1000`  | Numeric group ID. Files and directories are group-owned by this GID, so any user in that group (e.g. Samba, Syncthing) can read the image collection.   |
| `UMASK`  | `027`   | File-creation mask applied inside the container. `027` yields `0750` on directories and `0640` on files. The credential DB (`wallrus.db`) is always `0600` regardless. |

The defaults (`1000:1000`) match the first non-root user on most desktop and NAS distros — no change needed unless your host uses a different UID/GID.

## Fail-fast behavior

When `WALLRUS_AUTH_ENABLE=true` and any of the three credential vars is missing
or `WALLRUS_AUTH_SECRET` is shorter than 32 bytes, the daemon refuses to start
with an actionable error message pointing at how to generate a secret.

Set `WALLRUS_AUTH_ENABLE=false` to opt out (e.g. when a reverse proxy is
handling auth).
