/**
 * Tests for mobile boot logic.
 *
 * Mocks @capacitor/preferences, $lib/client/config, and the release manifest
 * fetch so no native toolchain or real network is required.
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
// Mock $lib/client/config
// ---------------------------------------------------------------------------

let _last_set_api_base: string | null = null
let _current_api_base = ""

mock.module("$lib/client/config", () => ({
	api_base: () => _current_api_base,
	set_api_base: (url: string) => {
		_last_set_api_base = url
		_current_api_base = url
	},
}))

// ---------------------------------------------------------------------------
// Mock version module
// ---------------------------------------------------------------------------

mock.module("./version", () => ({
	APP_VERSION: "1.0.0",
}))

// ---------------------------------------------------------------------------
// Mock global fetch for release manifest
// ---------------------------------------------------------------------------

let _mock_manifest: { version: string; mandatory: boolean; url: string } | null = null
let _manifest_fail = false

const original_fetch = globalThis.fetch

function setup_fetch_mock() {
	// Cast needed: bun's `typeof fetch` includes `preconnect` which is not
	// on the standard `fetch` signature; we only intercept the call path.
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = input.toString()
		if (url.includes("/api/v1/mobile/release/latest")) {
			if (_manifest_fail) throw new Error("network error")
			return new Response(
				JSON.stringify(_mock_manifest ?? { version: "", mandatory: false, url: "" }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			)
		}
		return original_fetch(input)
	}) as typeof fetch
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	for (const k of Object.keys(_prefs)) delete _prefs[k]
	_last_set_api_base = null
	_current_api_base = ""
	_mock_manifest = null
	_manifest_fail = false
	setup_fetch_mock()
})

// ---------------------------------------------------------------------------
// First launch (no api_base stored)
// ---------------------------------------------------------------------------

describe("boot() — first launch (no api_base stored)", () => {
	test("returns route=/setup", async () => {
		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/setup")
	})

	test("does not call set_api_base", async () => {
		const { boot } = await import("./boot")
		await boot()
		expect(_last_set_api_base).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Already configured — no update available
// ---------------------------------------------------------------------------

describe("boot() — configured, no update available", () => {
	test("returns route=/ with update=null when manifest version is same", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = { version: "1.0.0", mandatory: false, url: "" } // same as APP_VERSION

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).toBeNull()
		}
	})

	test("returns route=/ with update=null when manifest version is empty", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = null // endpoint returns { version: "" }

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).toBeNull()
		}
	})

	test("returns route=/ with update=null when manifest fetch fails", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_manifest_fail = true

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).toBeNull()
		}
	})

	test("calls set_api_base with the stored value", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = { version: "1.0.0", mandatory: false, url: "" }

		const { boot } = await import("./boot")
		await boot()
		expect(_last_set_api_base).toBe("http://192.168.1.100:5173")
	})
})

// ---------------------------------------------------------------------------
// Update available, non-mandatory
// ---------------------------------------------------------------------------

describe("boot() — update available (non-mandatory)", () => {
	test("returns update with correct version and mandatory=false", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = {
			version: "1.2.0",
			mandatory: false,
			url: "https://example.com/wallrus-1.2.0.apk",
		}

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).not.toBeNull()
			expect(result.update?.version).toBe("1.2.0")
			expect(result.update?.mandatory).toBe(false)
			expect(result.update?.url).toBe("https://example.com/wallrus-1.2.0.apk")
		}
	})
})

// ---------------------------------------------------------------------------
// Update available, mandatory
// ---------------------------------------------------------------------------

describe("boot() — update available (mandatory)", () => {
	test("returns update with mandatory=true", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = {
			version: "2.0.0",
			mandatory: true,
			url: "https://example.com/wallrus-2.0.0.apk",
		}

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).not.toBeNull()
			expect(result.update?.version).toBe("2.0.0")
			expect(result.update?.mandatory).toBe(true)
		}
	})

	test("older manifest version does not trigger update", async () => {
		_prefs["api_base"] = "http://192.168.1.100:5173"
		_mock_manifest = {
			version: "0.9.0", // older than APP_VERSION 1.0.0
			mandatory: true,
			url: "https://example.com/wallrus-0.9.0.apk",
		}

		const { boot } = await import("./boot")
		const result = await boot()
		expect(result.route).toBe("/")
		if (result.route === "/") {
			expect(result.update).toBeNull()
		}
	})
})
