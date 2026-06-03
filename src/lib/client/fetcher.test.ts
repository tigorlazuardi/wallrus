/**
 * Unit tests for $lib/client/fetcher.ts.
 *
 * Covers:
 *   - Empty base (default) → relative URL passed to fetch (web same-origin no-op)
 *   - Non-empty base → absolute URL prefixed
 *   - RequestInit is forwarded to the underlying fetch
 *   - Native branch: Authorization: Bearer header injected from stored auth_token
 *   - Web branch: no Authorization header (cookie path unchanged)
 */

import { afterEach, describe, expect, mock, test } from "bun:test"
import { set_api_base } from "./config"

// ---------------------------------------------------------------------------
// Mock @capacitor/preferences (shared across all tests)
// ---------------------------------------------------------------------------

let _mock_token: string | null = null

mock.module("@capacitor/preferences", () => ({
	Preferences: {
		get: ({ key }: { key: string }) =>
			Promise.resolve({ value: key === "auth_token" ? _mock_token : null }),
		set: () => Promise.resolve(),
		remove: () => Promise.resolve(),
	},
}))

// ---------------------------------------------------------------------------
// Mock platform seam (shared across all tests)
// ---------------------------------------------------------------------------

let _is_native = false

mock.module("$lib/client/mobile/platform", () => ({
	isNativePlatform: () => _is_native,
}))

// ---------------------------------------------------------------------------
// Fake fetch
// ---------------------------------------------------------------------------

type FetchCall = { url: string; init: RequestInit | undefined }

function make_fake_fetch(): { fake: typeof fetch; calls: FetchCall[] } {
	const calls: FetchCall[] = []
	const fake = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
		calls.push({ url: String(url), init })
		return Promise.resolve(new Response("ok", { status: 200 }))
	}
	return { fake: fake as unknown as typeof fetch, calls }
}

// ---------------------------------------------------------------------------
// Helpers — import apiFetch after patching globalThis.fetch per test
// ---------------------------------------------------------------------------

// We need to swap out globalThis.fetch before each call because apiFetch
// calls the global fetch. Use a wrapper that delegates to a per-test stub.
let _fetch_stub: typeof fetch | null = null

// Patch globalThis.fetch for the duration of the test suite.
const original_fetch = globalThis.fetch
const proxy_fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
	if (_fetch_stub) return _fetch_stub(url as string, init)
	return original_fetch(url as string, init)
}
globalThis.fetch = proxy_fetch as typeof fetch

afterEach(() => {
	_fetch_stub = null
	_is_native = false
	_mock_token = null
	set_api_base("")
})

// ---------------------------------------------------------------------------
// Web path tests (existing + extended)
// ---------------------------------------------------------------------------

describe("apiFetch() — empty base (web same-origin)", () => {
	test("passes the path as-is when api_base() is empty", async () => {
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		// Inline import to use the already-imported module.
		const { apiFetch } = await import("./fetcher")

		await apiFetch("/api/v1/devices")

		expect(calls).toHaveLength(1)
		expect(calls[0]!.url).toBe("/api/v1/devices")
	})

	test("relative URL is produced (no scheme prefix)", async () => {
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		const { apiFetch } = await import("./fetcher")

		await apiFetch("/api/v1/runs")

		expect(calls[0]!.url).not.toMatch(/^https?:\/\//)
	})
})

describe("apiFetch() — non-empty base (mobile / remote)", () => {
	test("prepends base URL to the path", async () => {
		set_api_base("http://192.168.1.100:5173")
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		const { apiFetch } = await import("./fetcher")

		await apiFetch("/api/v1/devices")

		expect(calls[0]!.url).toBe("http://192.168.1.100:5173/api/v1/devices")
	})

	test("does not double-slash when base has no trailing slash", async () => {
		set_api_base("http://192.168.1.100:5173")
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		const { apiFetch } = await import("./fetcher")

		await apiFetch("/api/v1/subscriptions")

		expect(calls[0]!.url).toBe("http://192.168.1.100:5173/api/v1/subscriptions")
	})
})

describe("apiFetch() — RequestInit forwarding", () => {
	test("passes method and body to underlying fetch", async () => {
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		const { apiFetch } = await import("./fetcher")

		const body = JSON.stringify({ name: "test" })
		await apiFetch("/api/v1/devices", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		})

		expect(calls[0]!.init?.method).toBe("POST")
		expect(calls[0]!.init?.body).toBe(body)
	})

	test("undefined init is forwarded as undefined", async () => {
		const { fake, calls } = make_fake_fetch()
		_fetch_stub = fake

		const { apiFetch } = await import("./fetcher")

		await apiFetch("/api/v1/devices")

		expect(calls[0]!.init).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// Native branch — Bearer injection
// ---------------------------------------------------------------------------

describe("apiFetch() — native platform with auth_token", () => {
	test("injects Authorization: Bearer header when token is stored", async () => {
		_is_native = true
		_mock_token = "test-jwt-token"
		set_api_base("http://192.168.1.100:5173")

		const capturedInits: RequestInit[] = []
		const fake_fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
			capturedInits.push(init ?? {})
			return Promise.resolve(new Response("ok", { status: 200 }))
		}
		_fetch_stub = fake_fetch as unknown as typeof fetch

		const { apiFetch } = await import("./fetcher")
		await apiFetch("/api/v1/devices")

		expect(capturedInits).toHaveLength(1)
		const headers = new Headers(capturedInits[0]!.headers)
		expect(headers.get("Authorization")).toBe("Bearer test-jwt-token")
	})

	test("preserves caller headers while injecting Bearer", async () => {
		_is_native = true
		_mock_token = "my-token"
		set_api_base("http://192.168.1.100:5173")

		const capturedInits: RequestInit[] = []
		const fake_fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
			capturedInits.push(init ?? {})
			return Promise.resolve(new Response("ok", { status: 200 }))
		}
		_fetch_stub = fake_fetch as unknown as typeof fetch

		const { apiFetch } = await import("./fetcher")
		await apiFetch("/api/v1/devices", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		})

		const headers = new Headers(capturedInits[0]!.headers)
		expect(headers.get("Authorization")).toBe("Bearer my-token")
		expect(headers.get("Content-Type")).toBe("application/json")
	})
})

// ---------------------------------------------------------------------------
// Web branch — no Bearer injection
// ---------------------------------------------------------------------------

describe("apiFetch() — web platform (no Bearer)", () => {
	test("does not inject Authorization header on web", async () => {
		_is_native = false
		_mock_token = "should-not-be-used"

		const capturedInits: (RequestInit | undefined)[] = []
		const fake_fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
			capturedInits.push(init)
			return Promise.resolve(new Response("ok", { status: 200 }))
		}
		_fetch_stub = fake_fetch as unknown as typeof fetch

		const { apiFetch } = await import("./fetcher")
		await apiFetch("/api/v1/devices")

		expect(capturedInits).toHaveLength(1)
		// init is undefined (no headers object was created)
		const headers = new Headers(capturedInits[0]?.headers)
		expect(headers.get("Authorization")).toBeNull()
	})
})
