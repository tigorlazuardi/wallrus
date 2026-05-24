# 003 — Auth: tasks

## Env

- [ ] `WALLRUS_AUTH_PASSWORD` (optional string) + `WALLRUS_AUTH_PASSWORD_HASH` (optional string) added to Zod schema in `src/lib/server/env.ts`
- [ ] Boot hashes plaintext if hash absent (`Bun.password.hash(…, { algorithm: "argon2id" })`), discards plaintext from the parsed env object
- [ ] At least one of `WALLRUS_AUTH_PASSWORD` / `WALLRUS_AUTH_PASSWORD_HASH` required when `WALLRUS_AUTH_ENABLE=true`; Zod refine errors otherwise
- [ ] Unit test: env parse fails when AUTH_ENABLE=true and both password vars absent
- [ ] Unit test: env parse strips plaintext from the returned object

## JWT

- [ ] `src/lib/server/auth/jwt.ts` exports `sign_session` + `verify_session`
- [ ] HS256, `iss: "wallrus"`, `aud: "wallrus"`, `exp` 30d from now
- [ ] `verify_session` returns null on every error (no throw)
- [ ] Unit test: roundtrip sign → verify returns the claims
- [ ] Unit test: expired token → null
- [ ] Unit test: wrong secret → null
- [ ] Unit test: tampered token → null

## Cookie

- [ ] `src/lib/server/auth/cookie.ts` exports `set_session_cookie` + `clear_session_cookie`
- [ ] HttpOnly, SameSite=Lax, Path=/, Max-Age=2592000, Secure on https
- [ ] Unit test: `Set-Cookie` header has the expected attributes
- [ ] Unit test: clear emits `Max-Age=0`

## Basic auth

- [ ] `src/lib/server/auth/basic.ts` exports `parse_basic`
- [ ] Strict `Basic ` prefix (case-sensitive); reject other schemes
- [ ] Unit test: valid → `{ username, password }`
- [ ] Unit test: malformed base64 → null
- [ ] Unit test: `Bearer …` → null
- [ ] Unit test: empty header → null
- [ ] Unit test: missing colon in decoded value → null

## Password

- [ ] `src/lib/server/auth/password.ts` exports `verify_password`
- [ ] Wraps `Bun.password.verify` with argon2id
- [ ] Unit test: matching plaintext → true
- [ ] Unit test: mismatching plaintext → false

## Rate limit

- [ ] `src/lib/server/auth/rate-limit.ts` exports `record_failure(ip)`, `is_locked(ip)`, `reset(ip)`
- [ ] 15-min sliding window, threshold 5
- [ ] Unit test: 5 failures → 6th `is_locked` returns true
- [ ] Unit test: window expiry resets the counter
- [ ] Unit test: `reset(ip)` clears immediately

## `authenticate` + hooks

- [ ] `src/lib/server/auth/index.ts` exports `authenticate(event)` per Decisions
- [ ] `src/hooks.server.ts` calls `authenticate`, sets `event.locals.user`, applies allowlist + gate
- [ ] Allowlist exact entries: `/healthz`, `/api/v1/otel/discover`, `/login`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/favicon.ico`, `/favicon.svg`
- [ ] Allowlist prefix entries: `/otlp/`, `/_app/`
- [ ] API gate (`startsWith("/api/")`) returns 401 JSON `{ error: { code, message } }`
- [ ] HTML gate redirects to `/login?next=<encoded>`
- [ ] Unit test (using helper `mock_event`): allowlist path passes through unauthenticated
- [ ] Unit test: API path unauthenticated → 401 JSON
- [ ] Unit test: HTML path unauthenticated → 302 to /login
- [ ] Unit test: AUTH_ENABLE=false → all paths pass with `auth_mode: "disabled"`

## Schemas

- [ ] `src/lib/schemas/auth/Login.ts` exports `LoginRequest` + `LoginResponse`
- [ ] `LoginRequest` = `{ username: z.string().min(1), password: z.string().min(1) }`
- [ ] `LoginResponse` = `z.object({})` (204)

## Routes

- [ ] `src/routes/api/v1/auth/login/+server.ts` POST: rate-limit → Zod parse → password verify → JWT sign → set cookie → 204
- [ ] Login 401 on bad password records failure
- [ ] Login 429 on locked IP, no password check performed
- [ ] `src/routes/api/v1/auth/logout/+server.ts` POST: clear cookie → 204
- [ ] Integration test (handler invoked with constructed Request): happy path returns 204 + Set-Cookie
- [ ] Integration test: bad password → 401, counter incremented
- [ ] Integration test: locked IP → 429

## Login page

- [ ] `src/routes/login/+page.svelte` minimal form (Email/User input + Password input + Submit) using shadcn-svelte Input/Button
- [ ] `+page.server.ts` uses sveltekit-superforms with `LoginRequest`; on success POSTs to `/api/v1/auth/login`, then redirects to `?next=` or `/`
- [ ] Already-authenticated visitor to `/login` redirects to `/`

## App types

- [ ] `src/app.d.ts` `Locals.user` typed as `{ name: string; auth_mode: "jwt" | "basic" | "disabled" }`
- [ ] `Locals.db` still present (from 002)

## OTLP proxy interaction

- [ ] `src/routes/otlp/v1/[signal]/+server.ts` test (or add one if missing) asserts 401 when AUTH_ENABLE=true and `WALLRUS_OTEL_FRONTEND=enable` and no auth supplied
- [ ] Same test asserts pass-through when Basic auth supplied
- [ ] Existing test for `WALLRUS_OTEL_FRONTEND=disable` → 404 still passes

## Docs

- [ ] `docs/src/content/docs/en/configuration/auth.md` matches: env vars, cookie name, session length 30d, lockout 5/15min, login endpoint
- [ ] `docs/src/content/docs/id/configuration/auth.md` mirrors EN

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke per IMPLEMENTATION.md "Verification gates"
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] One closing commit: `feat(auth): JWT cookie + Basic auth gate, login routes, rate-limited brute-force lockout`
- [ ] Body lists JWT, cookie attrs, Basic, allowlist, rate limit, login page
- [ ] Claude co-author trailer
- [ ] `git push`
- [ ] `Status: done` in `IMPLEMENTATION.md`
- [ ] `plans/README.md` index row → done
- [ ] `chore(plans): mark 003-auth done` (committed + pushed)

## Deferred

- Multi-user / OAuth / OIDC → not in MVP
- Refresh tokens / sliding session → not in MVP
- Password reset flow → not in MVP
