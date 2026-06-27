/**
 * Tests for use-auth-mutation.svelte.ts
 *
 * Mocks apiFetch, @capacitor/preferences, and the platform seam.
 * The hook follows the same stateless-action pattern as other mutation
 * hooks (see use-device-mutation.svelte.ts) — no $state runes.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

// ---------------------------------------------------------------------------
// Capture the REAL fetcher module BEFORE mock.module replaces it.
// ES import hoisting binds this to the real module; mock.module executes
// after top-level statements run but the import binding is already sealed.
// ---------------------------------------------------------------------------

import * as realFetcher from "$lib/client/fetcher"
const realApiFetch = realFetcher.apiFetch

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let _is_native = false
let _prefs_set_calls: Array<{ key: string; value: string }> = []

// Override slot: null → delegate to real apiFetch (no pollution of other test files).
type ApiFetchOverride = () => Promise<Response>
let _api_fetch_override: ApiFetchOverride | null = null

mock.module("$lib/client/mobile/platform", () => ({
	isNativePlatform: () => _is_native,
}))

mock.module("@capacitor/preferences", () => ({
	Preferences: {
		get: () => Promise.resolve({ value: null }),
		set: (opts: { key: string; value: string }) => {
			_prefs_set_calls.push(opts)
			return Promise.resolve()
		},
		remove: () => Promise.resolve(),
	},
}))

mock.module("$lib/client/fetcher", () => ({
	...realFetcher,
	apiFetch: (path: string, init?: RequestInit) =>
		_api_fetch_override ? _api_fetch_override() : realApiFetch(path, init),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLoginResponse = (status = 200) =>
	new Response(
		status === 200
			? JSON.stringify({ access_token: "tok-abc", expires_at: Date.now() + 3_600_000 })
			: "invalid_credentials",
		{ status, headers: { "content-type": "application/json" } },
	)

beforeEach(() => {
	_is_native = false
	_prefs_set_calls = []
	_api_fetch_override = null
})

afterEach(() => {
	_api_fetch_override = null
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAuthMutation().login() — native platform", () => {
	test("stores auth_token in Preferences after successful login", async () => {
		_is_native = true
		_api_fetch_override = () => Promise.resolve(makeLoginResponse(200))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await login("admin", "secret")

		expect(_prefs_set_calls).toHaveLength(1)
		expect(_prefs_set_calls[0]).toEqual({ key: "auth_token", value: "tok-abc" })
	})

	test("resolves without throwing on success", async () => {
		_is_native = true
		_api_fetch_override = () => Promise.resolve(makeLoginResponse(200))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).resolves.toBeUndefined()
	})
})

describe("useAuthMutation().login() — web platform", () => {
	test("does not call Preferences.set on web", async () => {
		_is_native = false
		_api_fetch_override = () => Promise.resolve(makeLoginResponse(200))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await login("admin", "secret")

		expect(_prefs_set_calls).toHaveLength(0)
	})

	test("resolves without throwing on success", async () => {
		_is_native = false
		_api_fetch_override = () => Promise.resolve(makeLoginResponse(200))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).resolves.toBeUndefined()
	})
})

describe("useAuthMutation().login() — error handling", () => {
	test("throws on 401 response", async () => {
		_api_fetch_override = () => Promise.resolve(new Response("invalid_credentials", { status: 401 }))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "wrong")).rejects.toThrow(/HTTP 401/)
	})

	test("throws on 500 response", async () => {
		_api_fetch_override = () => Promise.resolve(new Response("server error", { status: 500 }))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).rejects.toThrow(/HTTP 500/)
	})

	test("throws on network error", async () => {
		_api_fetch_override = () => Promise.reject(new Error("network failure"))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).rejects.toThrow("network failure")
	})
})
