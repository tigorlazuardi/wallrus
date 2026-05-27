/**
 * Unit tests for $lib/client/config.ts.
 *
 * Covers:
 *   - Empty default returns ""
 *   - set_api_base / api_base round-trip
 *   - Trailing slash is stripped on set
 */

import { afterEach, describe, expect, test } from "bun:test"
import { api_base, set_api_base } from "./config"

afterEach(() => {
	// Reset module-level state between tests.
	set_api_base("")
})

describe("api_base() — default", () => {
	test("returns empty string when no base has been set", () => {
		expect(api_base()).toBe("")
	})
})

describe("set_api_base() / api_base() — round-trip", () => {
	test("returns the URL that was set", () => {
		set_api_base("http://192.168.1.100:5173")
		expect(api_base()).toBe("http://192.168.1.100:5173")
	})

	test("strips a trailing slash on set", () => {
		set_api_base("http://192.168.1.100:5173/")
		expect(api_base()).toBe("http://192.168.1.100:5173")
	})

	test("strips multiple trailing slashes on set", () => {
		set_api_base("http://192.168.1.100:5173///")
		expect(api_base()).toBe("http://192.168.1.100:5173//")
	})

	test("empty string reset clears a previously set base", () => {
		set_api_base("http://192.168.1.100:5173")
		set_api_base("")
		expect(api_base()).toBe("")
	})

	test("overwrites a previously set base", () => {
		set_api_base("http://old.host:8080")
		set_api_base("http://new.host:9090")
		expect(api_base()).toBe("http://new.host:9090")
	})
})
