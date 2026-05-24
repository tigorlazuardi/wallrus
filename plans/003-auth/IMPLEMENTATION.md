# 003 — Auth

## Status

**done**

## Goal

Land the auth surface scoped in `engineering/SCOPE.md`:
`WALLRUS_AUTH_ENABLE` toggle, single-user username + password via env,
HS256 JWT in a `wallrus_session` cookie, Basic auth for API clients,
all sharing one `WALLRUS_AUTH_SECRET`. The `hooks.server.ts` gate enforces
auth on every request except a fixed allowlist.

## Decisions (pre-baked)

- **Library**: `jose` (already in deps) for `SignJWT` / `jwtVerify`.
  No refresh tokens. Cookie expiry = JWT expiry = 30 days.
- **Cookie**: name `wallrus_session`, `HttpOnly`, `SameSite=Lax`,
  `Secure` when `event.url.protocol === "https:"`, `Path=/`,
  `Max-Age=2592000`.
- **JWT claims**: `{ sub: env.WALLRUS_USERNAME, iat, exp,
iss: "wallrus", aud: "wallrus" }`. Algorithm: HS256. Secret:
  `env.WALLRUS_AUTH_SECRET` (already enforced ≥32 bytes by Zod in 001).
- **Password storage**: env-only. Compare via `Bun.password.verify` with
  `argon2id` hashing. The plaintext env value is hashed in-memory at boot
  and discarded; the hash is held by the lazy env singleton. Add
  `WALLRUS_PASSWORD` (plaintext) and `WALLRUS_PASSWORD_HASH`
  (optional pre-hashed override). Boot prefers the hash if present.
- **Allowlist** (paths that bypass auth even when enabled):
  `/healthz`, `/api/v1/otel/discover`, `/otlp/*`, `/login`,
  `/api/v1/auth/login`, `/api/v1/auth/logout`, `/_app/*` (SvelteKit
  static), `/favicon.*`.
- **API responses**: 401 with JSON `{ error: { code: "auth.unauthenticated",
message: "…" } }` matching the `AppError` shape from telemetry-js.
- **HTML responses**: redirect to `/login?next=<encoded>` for unauthenticated
  navigation requests (Accept includes `text/html`).
- **Login flow**: POST `/api/v1/auth/login` with `{ username, password }`
  → on match, set cookie + 204. POST `/api/v1/auth/logout` clears cookie.
- **Basic auth**: `Authorization: Basic base64(user:pass)` parsed in
  hooks; success short-circuits the cookie check and does **not** set a
  cookie (stateless for API clients).
- **`AUTH_ENABLE=false`**: hooks.server.ts sets `locals.user = { name:
env.WALLRUS_USERNAME ?? "anonymous", auth_mode: "disabled" }` and
  lets everything through. Login/logout routes still exist but return 204
  no-op when auth is disabled.
- **OTLP proxy auth coupling**: `WALLRUS_OTEL_FRONTEND=enable` already
  honours `locals.user`. Once this slice lands, the proxy correctly
  rejects unauthenticated POSTs when `AUTH_ENABLE=true`. Update its tests.
- **Rate limit**: 5 failed `/api/v1/auth/login` attempts per IP per 15 min
  trigger a 429. In-memory counter keyed by `event.getClientAddress()`.

## State at end of slice (target)

- `src/lib/server/auth/` new module: `jwt.ts`, `cookie.ts`, `basic.ts`,
  `password.ts`, `rate-limit.ts`, `index.ts` barrel.
- `src/hooks.server.ts` gates every non-allowlisted request.
- `src/routes/api/v1/auth/login/+server.ts` + `.../logout/+server.ts`.
- `src/routes/login/+page.svelte` (minimal form using superforms +
  shadcn-svelte Input/Button).
- `src/lib/server/env.ts` adds `WALLRUS_PASSWORD` (optional plaintext)
  and `WALLRUS_PASSWORD_HASH` (optional pre-hashed).
- `src/lib/schemas/auth/Login.ts` Zod schema (request + response).
- `app.d.ts` `Locals.user` typed `{ name: string; auth_mode: "jwt"
| "basic" | "disabled" }` (no more `null`).
- Unit + integration tests cover JWT roundtrip, cookie parse, Basic
  parse, password verify, allowlist hits, gate denials, rate limit.

## Resume here

1. **Env**: extend `src/lib/server/env.ts` with `WALLRUS_PASSWORD`
   (string optional) and `WALLRUS_PASSWORD_HASH` (string optional).
   Add a derived `password_hash` field on the parsed env object,
   computed once at parse time (`await Bun.password.hash(plaintext,
{ algorithm: "argon2id" })` if hash absent). Discard the plaintext
   from the returned object so it doesn't leak via inspect.
2. **`src/lib/server/auth/jwt.ts`**: `sign_session({ username,
secret }): Promise<string>` and `verify_session(token, secret):
Promise<{ sub, iat, exp } | null>`. Uses `jose` `SignJWT` /
   `jwtVerify` with `alg: "HS256"`, `iss: "wallrus"`, `aud: "wallrus"`.
   Return null on any verification error (don't throw across the
   boundary — the gate converts null → 401).
3. **`src/lib/server/auth/cookie.ts`**: `set_session_cookie(event,
token)` + `clear_session_cookie(event)`. Uses SvelteKit `cookies.set`
   / `cookies.delete` with the attribute matrix from Decisions.
4. **`src/lib/server/auth/basic.ts`**: `parse_basic(header: string |
null): { username, password } | null`. Strict — must start with
   `Basic ` (case-sensitive); reject malformed base64.
5. **`src/lib/server/auth/password.ts`**: `verify_password(plaintext,
hash): Promise<boolean>` wrapping `Bun.password.verify`.
6. **`src/lib/server/auth/rate-limit.ts`**: in-memory Map keyed by IP,
   sliding window 15 min, threshold 5 failures. Export `record_failure(ip)`
   and `is_locked(ip): boolean`. Clear on successful login.
7. **`src/lib/server/auth/index.ts`**: barrel + `authenticate(event):
Promise<Locals["user"] | null>` that:
   - Returns `{ name, auth_mode: "disabled" }` if `env.WALLRUS_AUTH_ENABLE
=== false`.
   - Tries `Authorization: Basic …` → `verify_password` → returns
     `{ name, auth_mode: "basic" }`.
   - Falls back to `wallrus_session` cookie → `verify_session` → returns
     `{ name: sub, auth_mode: "jwt" }`.
   - Returns null otherwise.
8. **`src/hooks.server.ts`**: rewrite `handle` to call `authenticate`,
   set `event.locals.user`, and gate: if the URL matches an allowlist
   pattern, pass through; else if `locals.user == null`, return 401
   JSON for API paths or 302 to `/login?next=…` for HTML.
9. **`src/routes/api/v1/auth/login/+server.ts`**: POST handler parsing
   `LoginRequest` via Zod, checking rate limit, verifying password,
   signing JWT, setting cookie, returning 204. On bad password,
   `record_failure(ip)` and 401.
10. **`src/routes/api/v1/auth/logout/+server.ts`**: POST clears cookie,
    returns 204.
11. **`src/routes/login/+page.svelte`** + `+page.server.ts`: simple form
    using sveltekit-superforms with the `LoginRequest` Zod schema.
    Redirect on success (respect `?next=`).
12. **`src/lib/schemas/auth/Login.ts`**: Zod `LoginRequest` and
    `LoginResponse` (`= z.object({})` since 204).
13. **Update OTLP proxy test/snapshot**: `src/routes/otlp/v1/[signal]/+server.test.ts`
    now asserts 401 on unauthenticated POST when `AUTH_ENABLE=true` and
    `WALLRUS_OTEL_FRONTEND=enable`.
14. **Tests**: see TASKS.md "Tests" section. Run them green.
15. **Docs**: `docs/src/content/docs/{en,id}/configuration/auth.md`
    — confirm the cookie name, session length, env vars, lockout
    threshold all match this slice.
16. Run Verification gates.
17. Commit + push per Done definition.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — new tests for jwt/cookie/basic/password/rate-limit/hooks
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke: `WALLRUS_AUTH_ENABLE=true WALLRUS_USERNAME=x
    WALLRUS_PASSWORD=y WALLRUS_AUTH_SECRET=$(openssl rand -hex 32)
    WALLRUS_MODE=prod bun run src/cli.ts serve` then:
  - `curl -i http://127.0.0.1:5173/api/v1/devices` → 401 JSON
  - `curl -i -u x:y http://127.0.0.1:5173/api/v1/devices` → 200/empty list
    or 404 (depends on whether 004 has landed; auth gate must let it through)
  - `curl -i http://127.0.0.1:5173/healthz` → 200 (allowlist)
  - `curl -i -X POST http://127.0.0.1:5173/api/v1/auth/login -d
'{"username":"x","password":"y"}' -H 'content-type: application/json'`
    → 204 with `Set-Cookie: wallrus_session=…`
  - 6th wrong password from same IP → 429
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

Closing commit:

```
feat(auth): JWT cookie + Basic auth gate, login routes, rate-limited brute-force lockout
```

Body lists: jose-based HS256 JWT, cookie attributes, Basic short-circuit,
allowlist, 5-failure-per-15min IP lockout, login/logout endpoints,
superforms login page. Trailer with Claude co-author.

Push (`git push`). Then `chore(plans): mark 003-auth done` (also pushed).

## Gotchas

- `Bun.password.hash` is CPU-bound; do it once at boot, never per request.
- JWT secret rotation is out of scope. If the operator changes
  `WALLRUS_AUTH_SECRET`, all existing sessions invalidate (expected).
- `event.getClientAddress()` can throw under SvelteKit if `address` isn't
  trusted by the platform adapter. Wrap in try/catch and fall back to a
  global counter so rate limit always works.
- The hooks.server.ts allowlist matches by `startsWith` on `event.url.pathname`
  — `/healthz` is exact match; `/otlp/v1/...` uses `startsWith("/otlp/")`.
  Be precise: `/login` allowlist must NOT also match `/login-evil`.
- When `AUTH_ENABLE=false`, login + logout routes return 204 but do not
  set/clear cookies (no-op). Tests assert this explicitly.

## Deferred

- Multi-user accounts → never (SCOPE).
- Password reset flow → no, single-operator daemon.
- OAuth/OIDC → no (reverse-proxy in front handles this if desired).
- Refresh tokens / sliding session → no, fixed 30-day expiry.
