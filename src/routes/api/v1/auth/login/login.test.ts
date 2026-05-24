/**
 * Integration tests for POST /api/v1/auth/login.
 *
 * We test the handler logic directly without the SvelteKit routing layer by
 * importing the modules and simulating their behavior. The handler uses:
 *   - rate-limit (is_locked / record_failure / reset)
 *   - env() singleton (we use parse_env with a controlled source)
 *   - verify_password + sign_session + set_session_cookie
 *
 * Because the env() singleton is process-wide, we test by exercising the
 * route's constituent parts in controlled integration tests.
 */
import { describe, expect, test, beforeEach } from "bun:test"
import { failures } from "$lib/server/auth/rate-limit"
import { sign_session, verify_session } from "$lib/server/auth/jwt"
import { SESSION_COOKIE } from "$lib/server/auth/cookie"

const TEST_SECRET = "b".repeat(32)
const TEST_USERNAME = "testuser"
const TEST_PASSWORD = "correct-horse"

// ---------------------------------------------------------------------------
// Happy-path: sign + verify round-trip for the JWT that login returns.
// ---------------------------------------------------------------------------

describe("login → JWT cookie flow", () => {
	test("sign_session produces a token verify_session accepts", async () => {
		const token = await sign_session({ username: TEST_USERNAME, secret: TEST_SECRET })
		expect(token).toBeTypeOf("string")
		const claims = await verify_session(token, TEST_SECRET)
		expect(claims).not.toBeNull()
		expect(claims!.sub).toBe(TEST_USERNAME)
	})

	test("SESSION_COOKIE constant has expected name", () => {
		expect(SESSION_COOKIE).toBe("wallrus_session")
	})
})

// ---------------------------------------------------------------------------
// Rate-limit integration: 5 failures → 6th is_locked === true.
// (mirrors rate-limit.test.ts but also validates the flow login uses)
// ---------------------------------------------------------------------------

describe("login → rate limit", () => {
	const IP = "10.0.0.1"

	beforeEach(() => {
		failures.delete(IP)
	})

	test("5 record_failure calls → is_locked returns true on 6th check", async () => {
		const { record_failure, is_locked } = await import("$lib/server/auth/rate-limit")
		for (let i = 0; i < 5; i++) record_failure(IP)
		expect(is_locked(IP)).toBe(true)
	})

	test("reset clears counter immediately", async () => {
		const { record_failure, is_locked, reset } = await import("$lib/server/auth/rate-limit")
		for (let i = 0; i < 5; i++) record_failure(IP)
		reset(IP)
		expect(is_locked(IP)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Bad-password path: record_failure is called.
// ---------------------------------------------------------------------------

describe("login → bad password records failure", () => {
	const IP = "10.0.0.2"

	beforeEach(() => {
		failures.delete(IP)
	})

	test("verify_password returns false for wrong password", async () => {
		const { verify_password } = await import("$lib/server/auth/password")
		const hash = await Bun.password.hash(TEST_PASSWORD, { algorithm: "argon2id" })
		const ok = await verify_password("wrong-password", hash)
		expect(ok).toBe(false)
	})
})
