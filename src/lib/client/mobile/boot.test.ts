/**
 * Tests for mobile boot logic.
 *
 * Mocks @capacitor/preferences and $lib/client/config so no native
 * toolchain or real Preferences storage is required.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test"

// ---------------------------------------------------------------------------
// Mock Preferences storage
// ---------------------------------------------------------------------------

const _prefs: Record<string, string | null> = {}

mock.module("@capacitor/preferences", () => ({
	Preferences: {
		get: ({ key }: { key: string }) => Promise.resolve({ value: _prefs[key] ?? null }),
		set: ({ key, value }: { key: string; value: string }) => {
			_prefs[key] = value
			return Promise.resolve()
		},
		remove: ({ key }: { key: string }) => {
			delete _prefs[key]
			return Promise.resolve()
		},
	},
}))

// ---------------------------------------------------------------------------
// Mock set_api_base
// ---------------------------------------------------------------------------

let _last_set_api_base: string | null = null

mock.module("$lib/client/config", () => ({
	api_base: () => _last_set_api_base ?? "",
	set_api_base: (url: string) => {
		_last_set_api_base = url
	},
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	// Clear prefs and recorded calls before each test.
	for (const k of Object.keys(_prefs)) {
		delete _prefs[k]
	}
	_last_set_api_base = null
})

describe("boot() — first launch (no api_base stored)", () => {
	test("returns /setup", async () => {
		const { boot } = await import("./boot")
		const route = await boot()
		expect(route).toBe("/setup")
	})

	test("does not call set_api_base", async () => {
		const { boot } = await import("./boot")
		await boot()
		expect(_last_set_api_base).toBeNull()
	})
})

describe("boot() — already configured (api_base stored)", () => {
	test("returns /", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"

		const { boot } = await import("./boot")
		const route = await boot()
		expect(route).toBe("/")
	})

	test("calls set_api_base with the stored value", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"

		const { boot } = await import("./boot")
		await boot()
		expect(_last_set_api_base).toBe("http://192.168.1.100:5173")
	})
})
