/**
 * Tests for use-auth-mutation.svelte.ts
 *
 * Mocks apiFetch, @capacitor/preferences, and the platform seam.
 * The hook follows the same stateless-action pattern as other mutation
 * hooks (see use-device-mutation.svelte.ts) — no $state runes.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let _is_native = false
let _prefs_set_calls: Array<{ key: string; value: string }> = []

// apiFetch mock — returns a 200 with a valid LoginResponse by default.
type FetchMock = () => Promise<Response>
let _fetch_mock: FetchMock = () =>
	Promise.resolve(
		new Response(
			JSON.stringify({ access_token: "tok-abc", expires_at: Date.now() + 3_600_000 }),
			{ status: 200, headers: { "content-type": "application/json" } },
		),
	)

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
	apiFetch: (_path: string, _init?: RequestInit) => _fetch_mock(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	_is_native = false
	_prefs_set_calls = []
	_fetch_mock = () =>
		Promise.resolve(
			new Response(
				JSON.stringify({ access_token: "tok-abc", expires_at: Date.now() + 3_600_000 }),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAuthMutation().login() — native platform", () => {
	test("stores auth_token in Preferences after successful login", async () => {
		_is_native = true

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await login("admin", "secret")

		expect(_prefs_set_calls).toHaveLength(1)
		expect(_prefs_set_calls[0]).toEqual({ key: "auth_token", value: "tok-abc" })
	})

	test("resolves without throwing on success", async () => {
		_is_native = true

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).resolves.toBeUndefined()
	})
})

describe("useAuthMutation().login() — web platform", () => {
	test("does not call Preferences.set on web", async () => {
		_is_native = false

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await login("admin", "secret")

		expect(_prefs_set_calls).toHaveLength(0)
	})

	test("resolves without throwing on success", async () => {
		_is_native = false

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).resolves.toBeUndefined()
	})
})

describe("useAuthMutation().login() — error handling", () => {
	test("throws on 401 response", async () => {
		_fetch_mock = () => Promise.resolve(new Response("invalid_credentials", { status: 401 }))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "wrong")).rejects.toThrow(/HTTP 401/)
	})

	test("throws on 500 response", async () => {
		_fetch_mock = () => Promise.resolve(new Response("server error", { status: 500 }))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).rejects.toThrow(/HTTP 500/)
	})

	test("throws on network error", async () => {
		_fetch_mock = () => Promise.reject(new Error("network failure"))

		const { useAuthMutation } = await import("./use-auth-mutation.svelte")
		const { login } = useAuthMutation()

		await expect(login("admin", "secret")).rejects.toThrow("network failure")
	})
})
