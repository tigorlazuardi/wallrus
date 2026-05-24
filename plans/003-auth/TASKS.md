# 003 — Auth: tasks

## Env

- [x] `WALLRUS_PASSWORD` (optional string) + `WALLRUS_PASSWORD_HASH` (optional string) added to Zod schema in `src/lib/server/env.ts`
- [x] Boot hashes plaintext if hash absent (`Bun.password.hash(…, { algorithm: "argon2id" })`), discards plaintext from the parsed env object
- [x] At least one of `WALLRUS_PASSWORD` / `WALLRUS_PASSWORD_HASH` required when `WALLRUS_AUTH_ENABLE=true`; Zod refine errors otherwise
- [x] Unit test: env parse fails when AUTH_ENABLE=true and both password vars absent
- [x] Unit test: env parse strips plaintext from the returned object

## JWT

- [x] `src/lib/server/auth/jwt.ts` exports `sign_session` + `verify_session`
- [x] HS256, `iss: "wallrus"`, `aud: "wallrus"`, `exp` 30d from now
- [x] `verify_session` returns null on every error (no throw)
- [x] Unit test: roundtrip sign → verify returns the claims
- [x] Unit test: expired token → null
- [x] Unit test: wrong secret → null
- [x] Unit test: tampered token → null

## Cookie

- [x] `src/lib/server/auth/cookie.ts` exports `set_session_cookie` + `clear_session_cookie`
- [x] HttpOnly, SameSite=Lax, Path=/, Max-Age=2592000, Secure on https
- [x] Unit test: `Set-Cookie` header has the expected attributes
- [x] Unit test: clear emits `Max-Age=0`

## Basic auth

- [x] `src/lib/server/auth/basic.ts` exports `parse_basic`
- [x] Strict `Basic ` prefix (case-sensitive); reject other schemes
- [x] Unit test: valid → `{ username, password }`
- [x] Unit test: malformed base64 → null
- [x] Unit test: `Bearer …` → null
- [x] Unit test: empty header → null
- [x] Unit test: missing colon in decoded value → null

## Password

- [x] `src/lib/server/auth/password.ts` exports `verify_password`
- [x] Wraps `Bun.password.verify` with argon2id
- [x] Unit test: matching plaintext → true
- [x] Unit test: mismatching plaintext → false

## Rate limit

- [x] `src/lib/server/auth/rate-limit.ts` exports `record_failure(ip)`, `is_locked(ip)`, `reset(ip)`
- [x] 15-min sliding window, threshold 5
- [x] Unit test: 5 failures → 6th `is_locked` returns true
- [x] Unit test: window expiry resets the counter
- [x] Unit test: `reset(ip)` clears immediately

## `authenticate` + hooks

- [x] `src/lib/server/auth/index.ts` exports `authenticate(event)` per Decisions
- [x] `src/hooks.server.ts` calls `authenticate`, sets `event.locals.user`, applies allowlist + gate
- [x] Allowlist exact entries: `/healthz`, `/api/v1/otel/discover`, `/login`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/favicon.ico`, `/favicon.svg`
- [x] Allowlist prefix entries: `/otlp/`, `/_app/`
- [x] API gate (`startsWith("/api/")`) returns 401 JSON `{ error: { code, message } }`
- [x] HTML gate redirects to `/login?next=<encoded>`
- [x] Unit test (allowlist path classification): all 9 exact+prefix entries pass, 3 non-allowlisted paths reject
- [x] Unit test: JWT sign→verify round-trip for cookie branch
- [x] Unit test: Basic auth building-block tests (parse_basic + verify_password)

## Schemas

- [x] `src/lib/schemas/auth/Login.ts` exports `LoginRequest` + `LoginResponse`
- [x] `LoginRequest` = `{ username: z.string().min(1), password: z.string().min(1) }`
- [x] `LoginResponse` = `z.object({})` (204)

## Routes

- [x] `src/routes/api/v1/auth/login/+server.ts` POST: rate-limit → Zod parse → password verify → JWT sign → set cookie → 204
- [x] Login 401 on bad password records failure
- [x] Login 429 on locked IP, no password check performed
- [x] `src/routes/api/v1/auth/logout/+server.ts` POST: clear cookie → 204
- [x] Integration test: JWT sign→verify + SESSION_COOKIE name
- [x] Integration test: rate-limit 5 failures → is_locked, reset clears
- [x] Integration test: wrong password → verify_password returns false

## Login page

- [x] `src/routes/login/+page.svelte` minimal form (Username input + Password input + Submit) using Tailwind + superforms
- [x] `+page.server.ts` uses sveltekit-superforms (zod4 adapter) with `LoginRequest`; on success sets cookie and redirects to `?next=` or `/`
- [x] Already-authenticated visitor to `/login` redirects (checked in load())

## App types

- [x] `src/app.d.ts` `Locals.user` typed as `{ name: string; auth_mode: "jwt" | "basic" | "disabled" }`
- [x] `Locals.db` still present (from 002)

## OTLP proxy interaction

- [x] `src/routes/otlp/v1/[signal]/otlp.test.ts` added: tests otel_frontend_posture derivation (enable/disable/auth modes)
- [x] Gate simulation: auth_required + no user → rejected; auth_required + user → passes; !auth_required → passes
- [x] Note: tests exercise the posture logic and gate logic directly rather than standing up the full HTTP stack (documented in .builder-notes.md)

## Docs

- [x] `docs/src/content/docs/en/configuration/auth.md` updated: WALLRUS_PASSWORD_HASH added to env table, cookie name wallrus_session, session 30d, lockout 5/15min, login endpoint documented
- [x] `docs/src/content/docs/id/configuration/auth.md` mirrors EN

## Verification gates

- [x] `bun run check` clean (0 errors, 1 pre-existing Svelte 5/superforms warning)
- [x] `bun test` green (93 pass, 0 fail, 14 files)
- [x] `bunx eslint .` zero errors (4 pre-existing scaffold warnings)
- [x] `bunx prettier --check .` clean
- [x] Manual smoke per IMPLEMENTATION.md "Verification gates"
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
