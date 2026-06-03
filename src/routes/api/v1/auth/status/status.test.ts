/**
 * Tests for GET /api/v1/auth/status.
 *
 * The handler is a thin wrapper around env().WALLRUS_AUTH_ENABLE.
 * We test the logic directly by:
 *   1. Parsing the env with a controlled source via parse_env.
 *   2. Verifying that AuthStatusSchema accepts / rejects expected shapes.
 *
 * This mirrors the login.test.ts approach — we exercise the constituent
 * parts without spinning up a full SvelteKit server.
 */
import { describe, expect, test } from "bun:test"
import { parse_env } from "$lib/server/env"
import { AuthStatusSchema } from "$lib/schemas/auth/AuthStatus"

// ---------------------------------------------------------------------------
// Schema contract — ensures the response shape is stable.
// ---------------------------------------------------------------------------

describe("AuthStatusSchema", () => {
	test("accepts { auth_enabled: true }", () => {
		const result = AuthStatusSchema.safeParse({ auth_enabled: true })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.auth_enabled).toBe(true)
	})

	test("accepts { auth_enabled: false }", () => {
		const result = AuthStatusSchema.safeParse({ auth_enabled: false })
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.auth_enabled).toBe(false)
	})

	test("rejects missing auth_enabled", () => {
		const result = AuthStatusSchema.safeParse({})
		expect(result.success).toBe(false)
	})

	test("rejects non-boolean auth_enabled", () => {
		const result = AuthStatusSchema.safeParse({ auth_enabled: "true" })
		expect(result.success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Env → auth_enabled mapping.
// ---------------------------------------------------------------------------

describe("auth/status — WALLRUS_AUTH_ENABLE env mapping", () => {
	test("parse_env with WALLRUS_AUTH_ENABLE=true → auth_enabled true", () => {
		const e = parse_env({
			WALLRUS_AUTH_ENABLE: "true",
			WALLRUS_USERNAME: "admin",
			WALLRUS_PASSWORD_HASH: "fakehash",
			WALLRUS_AUTH_SECRET: "a".repeat(32),
		})
		// The field is transformed by Zod to boolean.
		const status = { auth_enabled: e.WALLRUS_AUTH_ENABLE }
		const result = AuthStatusSchema.safeParse(status)
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.auth_enabled).toBe(true)
	})

	test("parse_env with WALLRUS_AUTH_ENABLE=false → auth_enabled false", () => {
		const e = parse_env({ WALLRUS_AUTH_ENABLE: "false" })
		const status = { auth_enabled: e.WALLRUS_AUTH_ENABLE }
		const result = AuthStatusSchema.safeParse(status)
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.auth_enabled).toBe(false)
	})

	test("parse_env with no WALLRUS_AUTH_ENABLE → defaults to false", () => {
		const e = parse_env({})
		const status = { auth_enabled: e.WALLRUS_AUTH_ENABLE }
		const result = AuthStatusSchema.safeParse(status)
		expect(result.success).toBe(true)
		if (result.success) expect(result.data.auth_enabled).toBe(false)
	})
})
