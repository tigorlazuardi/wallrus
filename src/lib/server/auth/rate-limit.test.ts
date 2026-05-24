import { afterEach, describe, expect, test } from "bun:test"
import { failures, is_locked, record_failure, reset, WINDOW_MS } from "./rate-limit"

const IP = "192.168.1.1"
const IP2 = "10.0.0.2"

afterEach(() => {
	// Clean up both test IPs so tests don't bleed into each other.
	reset(IP)
	reset(IP2)
})

describe("rate-limit", () => {
	test("5 failures → 6th is_locked returns true", () => {
		for (let i = 0; i < 5; i++) {
			record_failure(IP)
		}
		expect(is_locked(IP)).toBe(true)
	})

	test("4 failures → is_locked is still false", () => {
		for (let i = 0; i < 4; i++) {
			record_failure(IP)
		}
		expect(is_locked(IP)).toBe(false)
	})

	test("reset clears immediately", () => {
		for (let i = 0; i < 5; i++) {
			record_failure(IP)
		}
		expect(is_locked(IP)).toBe(true)
		reset(IP)
		expect(is_locked(IP)).toBe(false)
	})

	test("different IPs are tracked independently", () => {
		for (let i = 0; i < 5; i++) {
			record_failure(IP)
		}
		expect(is_locked(IP)).toBe(true)
		expect(is_locked(IP2)).toBe(false)
	})

	test("window expiry resets the counter", () => {
		// Inject stale timestamps directly into the exported failures map.
		// Timestamps older than WINDOW_MS should be pruned by is_locked.
		const now = Date.now()
		const stale = now - WINDOW_MS - 1000 // 1 second beyond the window
		failures.set(IP, [stale, stale, stale, stale, stale])

		// 5 stale failures should be pruned → not locked
		expect(is_locked(IP)).toBe(false)
	})
})
