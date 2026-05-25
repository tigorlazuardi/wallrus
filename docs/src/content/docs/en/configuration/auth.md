---
title: Authentication
description: Built-in single-user auth vs reverse-proxy auth.
---

wallrus has **one** authentication model: a single shared username + password.
Multi-user is intentionally out of scope. There are two deployment shapes.

**Default posture: auth disabled** (`WALLRUS_AUTH_ENABLE=false`). Fresh installs
serve every route publicly, on the assumption that a reverse proxy in front of
wallrus is responsible for keeping unauthenticated traffic out. If you are
running wallrus directly exposed without a reverse proxy, jump to section A
and turn auth on before binding to a public interface.

## A. Built-in auth (single shared credential)

Set:

```sh
export WALLRUS_AUTH_ENABLE=true
export WALLRUS_USERNAME=admin
export WALLRUS_PASSWORD='change-me-please'
export WALLRUS_AUTH_SECRET="$(openssl rand -hex 32)"
```

Alternatively, if you already have an Argon2id hash of your password, skip
`WALLRUS_PASSWORD` and pass the hash directly:

```sh
export WALLRUS_PASSWORD_HASH='$argon2id$v=19$m=65536,...'
```

At most one of `WALLRUS_PASSWORD` / `WALLRUS_PASSWORD_HASH` is needed; if you
supply the plaintext the daemon hashes it at boot and discards the plaintext
from memory.

| Variable                | Required when auth enabled | Default | Notes                                                     |
| ----------------------- | :------------------------: | ------- | --------------------------------------------------------- |
| `WALLRUS_USERNAME`      | Yes                        | —       | The single login username.                                |
| `WALLRUS_PASSWORD`      | One of these two           | —       | Plaintext password; hashed at boot, then discarded.       |
| `WALLRUS_PASSWORD_HASH` | One of these two           | —       | Pre-computed Argon2id hash (use instead of the plaintext).|
| `WALLRUS_AUTH_SECRET`   | Yes                        | —       | ≥ 32 bytes of entropy. Generate: `openssl rand -hex 32`.  |
| `WALLRUS_JWT_TTL_DAYS`  | No                         | `30`    | JWT / session-cookie lifetime in days.                    |

Three credentials accepted at the API:

- `Authorization: Bearer <jwt>` — primary for mobile / scripts. Obtain a JWT
  via `POST /api/v1/auth/login` with `{ "username", "password" }`.
- `Authorization: Basic base64(user:pass)` — convenience for curl / tests.
- `wallrus_session` cookie — set by the WebUI login form. HttpOnly,
  SameSite=Lax, rotates when `WALLRUS_AUTH_SECRET` rotates.

### Login endpoint

```
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "admin", "password": "change-me-please" }
```

Success: `204 No Content` + `Set-Cookie: wallrus_session=<jwt>; ...`

### Session details

- Cookie name: `wallrus_session`
- Session length: **30 days** (configurable via `WALLRUS_JWT_TTL_DAYS`)
- Brute-force protection: **5 failed attempts** within **15 minutes** triggers
  a `429 Too Many Requests` lockout on that IP. Resets automatically after the
  window passes or on a successful login.

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
- `POST /api/v1/auth/login` returns `204 No Content` (no-op; safe to call but
  does not set a cookie).
- A single startup warning is logged so the choice is visible.

Your reverse proxy is now solely responsible for keeping unauthenticated
traffic out. Recommended setups: Authelia + nginx/Caddy/Traefik,
Tailscale Funnel + Serve, or any OIDC-aware gateway.

## Why no JWT refresh tokens, multi-user, or password reset?

- Single-user → re-login on JWT expiry is cheap; no refresh complexity needed.
- Multi-user → out of scope; install a real identity provider in front if you
  need it.
- Password reset → out of scope; rotate env vars and restart.
