---
title: Authentication
description: Built-in single-user auth vs reverse-proxy auth.
---

wallrus has **one** authentication model: a single shared username + password.
Multi-user is intentionally out of scope. There are two deployment shapes.

## A. Built-in auth (single shared credential)

Set:

```sh
export WALLRUS_AUTH_ENABLE=true
export WALLRUS_USERNAME=admin
export WALLRUS_PASSWORD='change-me-please'
export WALLRUS_AUTH_SECRET="$(openssl rand -hex 32)"
```

Three credentials accepted at the API:

- `Authorization: Bearer <jwt>` — primary for mobile / scripts. Get a JWT via
  `POST /api/v1/auth/login` with `{ "username", "password" }`.
- `Authorization: Basic base64(user:pass)` — convenience for curl / tests.
- `auth_session` cookie — set by the WebUI login form. httpOnly, SameSite=Lax,
  rotates when `WALLRUS_AUTH_SECRET` rotates.

The WebUI ships a simple HTML login page. The JWT TTL defaults to 30 days.
No refresh tokens — re-login on expiry.

### Rotation

Change `WALLRUS_AUTH_SECRET` (or username/password) and restart. Every
existing cookie and every previously-issued JWT becomes invalid in one shot.

## B. Reverse-proxy auth (Authelia / Tailscale / OIDC)

Set:

```sh
export WALLRUS_AUTH_ENABLE=false
export WALLRUS_TRUST_PROXY=true  # if behind https
```

When auth is disabled:

- Every route is public from wallrus's perspective.
- `GET /auth/login` returns `404`.
- `POST /api/v1/auth/login` returns `410 Gone`, body `{ "error": "auth_disabled" }`.
- A single startup warning is logged so the choice is visible.

Your reverse proxy is now solely responsible for keeping unauthenticated
traffic out. Recommended setups: Authelia + nginx/Caddy/Traefik,
Tailscale Funnel + Serve, or any OIDC-aware gateway.

## Why no JWT refresh tokens, multi-user, or password reset?

- Single-user → re-login on JWT expiry is cheap; no refresh complexity needed.
- Multi-user → out of scope; install a real identity provider in front if you
  need it.
- Password reset → out of scope; rotate env vars and restart.
