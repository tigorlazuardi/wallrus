---
title: Environment variables
description: Every env var wallrus reads, what it defaults to, and what it gates.
---

This is the **single canonical list** of every environment variable wallrus
reads. The source of truth is `src/lib/server/env.ts` in the repo — when
that file changes, this page changes in lockstep (both locales).

## Required when auth is enabled

These are required only when `WALLRUS_AUTH_ENABLE=true` (the default).

| Variable                | Required | Default | Description                                                                                                                  |
| ----------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `WALLRUS_USERNAME`      | yes (if auth on) | —       | Single shared username for the WebUI and the JSON API.                                                                       |
| `WALLRUS_PASSWORD`      | yes (if auth on) | —       | Single shared password. Comparisons are timing-safe.                                                                         |
| `WALLRUS_AUTH_SECRET`   | yes (if auth on) | —       | At least 32 bytes of entropy. Drives the cookie HMAC marker AND the HS256 JWT signing key. Generate with `openssl rand -hex 32`. |

If `WALLRUS_AUTH_ENABLE=false`, all three are ignored.

## Always available

| Variable                | Default                | Description                                                                                                                          |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `WALLRUS_AUTH_ENABLE`   | `true`                 | `"true"` or `"false"`. When `false`, every route is public and the login endpoints return `404` / `410`. Intended for reverse-proxy deployments. |
| `WALLRUS_DATA_DIR`      | `./data` (bare-metal) `\| /data/wallrus` (Docker image) | Directory holding the SQLite DB, thumbnails, staging files, and per-device subdirs. Daemon enforces `chmod 0700` on this dir. |
| `WALLRUS_LISTEN_ADDR`   | `0.0.0.0:5173`         | Host + port the HTTP server binds to.                                                                                                |
| `WALLRUS_JWT_TTL_DAYS`  | `30`                   | Lifetime of issued JWTs (positive integer). No refresh tokens; re-login when expired.                                                |
| `WALLRUS_TRUST_PROXY`   | `false`                | `"true"` or `"false"`. When on, wallrus trusts `X-Forwarded-Proto` + `X-Forwarded-For` from the first hop only.                       |

## OpenTelemetry (standard OTel envs)

wallrus reads the **standard** OpenTelemetry env names. Set the same variables you'd use with any OTel-compliant SDK or collector.

| Variable                       | Default    | Description                                                                                                                                                |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | unset      | Base URL of an OpenTelemetry collector (e.g. `http://otel-collector:4318`). When unset, OTLP export is disabled and logs go to stderr only.                |
| `OTEL_SERVICE_NAME`            | `wallrus`  | Service name reported in every span / log / metric. Override if you run multiple wallrus instances behind one collector.                                   |
| `OTEL_RESOURCE_ATTRIBUTES`     | unset      | Comma-separated `key=value` pairs merged into the OpenTelemetry Resource (e.g. `deployment.environment=prod,service.instance.id=tv-rack`). Defaults include `service.namespace=homelab`. |

## Fail-fast behavior

When `WALLRUS_AUTH_ENABLE=true` and any of the three credential vars is missing
or `WALLRUS_AUTH_SECRET` is shorter than 32 bytes, the daemon refuses to start
with an actionable error message pointing at how to generate a secret.

Set `WALLRUS_AUTH_ENABLE=false` to opt out (e.g. when a reverse proxy is
handling auth).
