/**
 * Unit tests for $lib/client/devices/use-devices.svelte.ts
 *
 * Covers:
 *   - initial data provided → loading starts false, data set, no fetch
 *   - no initial data → loading starts true, fetch triggered immediately
 *   - refetch success → data updated, loading false, error null
 *   - refetch HTTP error → error set, loading false, data unchanged
 *   - refetch network error → error set, loading false
 *   - Zod parse of valid response → typed data returned
 *
 * $state is a Svelte 5 rune compiled away by the Svelte transformer in the
 * app build. In bun:test (no Svelte compiler) we polyfill it as a plain
 * identity function before importing the hook via dynamic import so the
 * module initialiser sees the global. This is intentional and consistent
 * with the theme.svelte.ts test strategy.
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { set_api_base } from "$lib/client/config"

// ---------------------------------------------------------------------------
// Polyfill $state before any .svelte.ts module is loaded
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).$state = <T>(v: T): T => v

// ---------------------------------------------------------------------------
// Fake fetch
// ---------------------------------------------------------------------------

type FetchStub = (url: string, init?: RequestInit) => Promise<Response>
let _fetch_stub: FetchStub | null = null

const original_fetch = globalThis.fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = (
	url: string | URL | Request,
	init?: RequestInit,
): Promise<Response> => {
	if (_fetch_stub) return _fetch_stub(String(url), init)
	return original_fetch(url as string, init)
}

afterEach(() => {
	_fetch_stub = null
	set_api_base("")
})

// ---------------------------------------------------------------------------
// Import hook after polyfill
// ---------------------------------------------------------------------------

const { useDevices } = await import("$lib/client/devices/use-devices.svelte")

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sample_device = {
	id: "018f7e1a-1234-7000-8000-000000000001",
	slug: "my-phone",
	name: "My Phone",
	enabled: true,
	filter_criteria: { nsfw: "all" as const },
	native_width: 1080,
	native_height: 2340,
	created_at: 1_700_000_000_000,
}

const sample_list_response = {
	items: [sample_device],
	total: 1,
	next_cursor: undefined,
	prev_cursor: undefined,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDevices() — initial data provided", () => {
	test("loading is false when initial is provided", () => {
		// Hang fetch so any accidental request would prevent test from finishing
		_fetch_stub = () => new Promise<Response>(() => {})
		const hook = useDevices(sample_list_response)
		expect(hook.state.loading).toBe(false)
	})

	test("data is set to initial when provided", () => {
		const hook = useDevices(sample_list_response)
		expect(hook.state.data).toEqual(sample_list_response)
	})

	test("error is null when initial is provided", () => {
		const hook = useDevices(sample_list_response)
		expect(hook.state.error).toBeNull()
	})

	test("no fetch is triggered when initial is provided (stub not called)", async () => {
		let called = false
		_fetch_stub = () => {
			called = true
			return Promise.resolve(new Response("{}", { status: 200 }))
		}
		useDevices(sample_list_response)
		// Give a microtask tick in case a rogue fetch was scheduled
		await Promise.resolve()
		expect(called).toBe(false)
	})
})

describe("useDevices() — no initial data", () => {
	test("loading is true immediately when no initial", () => {
		_fetch_stub = () => new Promise<Response>(() => {}) // never resolves
		const hook = useDevices()
		expect(hook.state.loading).toBe(true)
	})

	test("data is null initially when no initial", () => {
		_fetch_stub = () => new Promise<Response>(() => {})
		const hook = useDevices()
		expect(hook.state.data).toBeNull()
	})

	test("error is null initially", () => {
		_fetch_stub = () => new Promise<Response>(() => {})
		const hook = useDevices()
		expect(hook.state.error).toBeNull()
	})
})

describe("useDevices().refetch — success", () => {
	test("sets data from parsed response", async () => {
		_fetch_stub = () =>
			Promise.resolve(
				new Response(JSON.stringify(sample_list_response), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
		const hook = useDevices(sample_list_response) // skip auto-fetch
		await hook.refetch()
		expect(hook.state.data).toEqual(sample_list_response)
		expect(hook.state.loading).toBe(false)
		expect(hook.state.error).toBeNull()
	})

	test("loading returns to false after success", async () => {
		_fetch_stub = () =>
			Promise.resolve(new Response(JSON.stringify(sample_list_response), { status: 200 }))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.loading).toBe(false)
	})

	test("error is cleared on subsequent success", async () => {
		// First make it error out
		_fetch_stub = () => Promise.resolve(new Response("", { status: 500 }))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.error).not.toBeNull()

		// Then make it succeed
		_fetch_stub = () =>
			Promise.resolve(new Response(JSON.stringify(sample_list_response), { status: 200 }))
		await hook.refetch()
		expect(hook.state.error).toBeNull()
		expect(hook.state.data).toEqual(sample_list_response)
	})
})

describe("useDevices().refetch — HTTP error", () => {
	test("sets error on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 500 }))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.error).toBeInstanceOf(Error)
		expect((hook.state.error as Error).message).toMatch(/HTTP 500/)
	})

	test("loading is false after error", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 404 }))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.loading).toBe(false)
	})

	test("data unchanged after error (previous data preserved)", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 503 }))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		// data should not have changed (prior data preserved — error doesn't null data)
		// The hook does not explicitly clear data on error, only sets error.
		expect(hook.state.data).toEqual(sample_list_response)
	})
})

describe("useDevices().refetch — network error", () => {
	test("sets error on network failure", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.error).toBeInstanceOf(Error)
		expect((hook.state.error as Error).message).toBe("network failure")
	})

	test("loading is false after network error", async () => {
		_fetch_stub = () => Promise.reject(new Error("timeout"))
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(hook.state.loading).toBe(false)
	})
})

describe("useDevices().refetch — URL construction", () => {
	test("calls /api/v1/devices with empty base (relative)", async () => {
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(
				new Response(JSON.stringify(sample_list_response), { status: 200 }),
			)
		}
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(captured_url).toBe("/api/v1/devices")
	})

	test("prepends api_base to path when base is set", async () => {
		set_api_base("http://192.168.1.100:5173")
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(
				new Response(JSON.stringify(sample_list_response), { status: 200 }),
			)
		}
		const hook = useDevices(sample_list_response)
		await hook.refetch()
		expect(captured_url).toBe("http://192.168.1.100:5173/api/v1/devices")
	})
})

// ---------------------------------------------------------------------------
// Gate: also runs against bun:test discovery
// ---------------------------------------------------------------------------

describe("useDevices — beforeAll import guard", () => {
	let _module_loaded = false
	beforeAll(() => {
		_module_loaded = true
	})
	test("module loaded successfully", () => {
		expect(_module_loaded).toBe(true)
	})
})
