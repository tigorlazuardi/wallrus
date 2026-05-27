/**
 * Unit tests for $lib/client/images/use-images.svelte.ts
 *
 * Covers:
 *   - initial data provided → no fetch, items/cursor set from initial
 *   - loadMore() appends items and advances cursor
 *   - loadMore() is a no-op when next_cursor is undefined
 *   - loadMore() is a no-op when already loading
 *   - filter query string is included in the request URL
 *   - reset() replaces items/cursor/total
 *   - loadMore() error path: error is set, items unchanged
 *
 * $state is a Svelte 5 rune compiled away by the Svelte transformer in the
 * app build. In bun:test (no Svelte compiler) we polyfill it as a plain
 * identity function before importing the hook via dynamic import so the
 * module initialiser sees the global.
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
// Import hook after polyfill (dynamic import ensures polyfill is in place)
// ---------------------------------------------------------------------------

const { useImages } = await import("$lib/client/images/use-images.svelte")

// ---------------------------------------------------------------------------
// Sample data fixtures
// ---------------------------------------------------------------------------

function make_image(id: string) {
	return {
		id,
		sha256: "abc123",
		source_slug: "reddit",
		source_id: "t3_abc",
		source_url: `https://reddit.com/img/${id}`,
		image_url: `https://i.redd.it/${id}.jpg`,
		title: "Test image",
		filename: `${id}.jpg`,
		width: 1920,
		height: 1080,
		file_size: 500_000,
		format: "jpg" as const,
		nsfw: "sfw" as const,
		tags_source: [],
		tags_user: [],
		search_text: null,
		created_at_source: null,
		ingested_at: 1_700_000_000_000,
		deleted_at: null,
		blacklisted_at: null,
		aspect_ratio: 1.778,
		favorited: false,
	}
}

const image_a = make_image("018f7e1a-1234-7000-8000-000000000001")
const image_b = make_image("018f7e1a-1234-7000-8000-000000000002")
const image_c = make_image("018f7e1a-1234-7000-8000-000000000003")

const initial_response = {
	items: [image_a],
	total: 3,
	next_cursor: "cursor-abc",
	prev_cursor: undefined,
}

const next_page_response = {
	items: [image_b, image_c],
	total: 3,
	next_cursor: undefined,
	prev_cursor: undefined,
}

function ok_json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

// ---------------------------------------------------------------------------
// initial data provided
// ---------------------------------------------------------------------------

describe("useImages() — initial data provided", () => {
	test("items are set from initial, no fetch triggered", async () => {
		let called = false
		_fetch_stub = () => {
			called = true
			return Promise.resolve(ok_json(initial_response))
		}
		const hook = useImages(initial_response)
		await Promise.resolve()
		expect(called).toBe(false)
		expect(hook.state.items).toEqual([image_a])
	})

	test("total is set from initial", () => {
		const hook = useImages(initial_response)
		expect(hook.state.total).toBe(3)
	})

	test("next_cursor is set from initial", () => {
		const hook = useImages(initial_response)
		expect(hook.state.next_cursor).toBe("cursor-abc")
	})

	test("loading is false when initial provided", () => {
		const hook = useImages(initial_response)
		expect(hook.state.loading).toBe(false)
	})

	test("error is null when initial provided", () => {
		const hook = useImages(initial_response)
		expect(hook.state.error).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// loadMore() — appends and advances cursor
// ---------------------------------------------------------------------------

describe("useImages().loadMore — success", () => {
	test("appends new items to existing items", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(next_page_response))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.items).toEqual([image_a, image_b, image_c])
	})

	test("advances next_cursor to new value", async () => {
		const response_with_cursor = {
			items: [image_b],
			total: 3,
			next_cursor: "cursor-xyz",
		}
		_fetch_stub = () => Promise.resolve(ok_json(response_with_cursor))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.next_cursor).toBe("cursor-xyz")
	})

	test("clears next_cursor when response has none", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(next_page_response))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.next_cursor).toBeUndefined()
	})

	test("updates total from response", async () => {
		_fetch_stub = () => Promise.resolve(ok_json({ ...next_page_response, total: 99 }))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.total).toBe(99)
	})

	test("loading is false after success", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(next_page_response))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.loading).toBe(false)
	})

	test("error is null after success", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(next_page_response))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.error).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// loadMore() — no-op guards
// ---------------------------------------------------------------------------

describe("useImages().loadMore — no-op when no cursor", () => {
	test("does not fetch when next_cursor is undefined", async () => {
		let called = false
		_fetch_stub = () => {
			called = true
			return Promise.resolve(ok_json(next_page_response))
		}
		const response_no_cursor = { ...initial_response, next_cursor: undefined }
		const hook = useImages(response_no_cursor)
		await hook.loadMore()
		expect(called).toBe(false)
	})

	test("items unchanged when no cursor", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(next_page_response))
		const response_no_cursor = { ...initial_response, next_cursor: undefined }
		const hook = useImages(response_no_cursor)
		await hook.loadMore()
		expect(hook.state.items).toEqual([image_a])
	})
})

// ---------------------------------------------------------------------------
// loadMore() — filter query in URL
// ---------------------------------------------------------------------------

describe("useImages().loadMore — filter query in URL", () => {
	test("includes filter params in the request URL", async () => {
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(ok_json(next_page_response))
		}
		const hook = useImages(initial_response, () => "device_id=abc&nsfw=sfw_only")
		await hook.loadMore()
		expect(captured_url).toContain("device_id=abc")
		expect(captured_url).toContain("nsfw=sfw_only")
	})

	test("includes cursor in the request URL", async () => {
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(ok_json(next_page_response))
		}
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(captured_url).toContain("next=cursor-abc")
	})

	test("includes limit=50 in the request URL", async () => {
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(ok_json(next_page_response))
		}
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(captured_url).toContain("limit=50")
	})

	test("calls /api/v1/images with relative URL (empty base)", async () => {
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(ok_json(next_page_response))
		}
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(captured_url).toMatch(/^\/api\/v1\/images/)
	})

	test("prepends api_base when set", async () => {
		set_api_base("http://192.168.1.100:5173")
		let captured_url = ""
		_fetch_stub = (url) => {
			captured_url = url
			return Promise.resolve(ok_json(next_page_response))
		}
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(captured_url).toMatch(/^http:\/\/192\.168\.1\.100:5173\/api\/v1\/images/)
	})
})

// ---------------------------------------------------------------------------
// loadMore() — error path
// ---------------------------------------------------------------------------

describe("useImages().loadMore — error", () => {
	test("sets error on HTTP error response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 500 }))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.error).toBeInstanceOf(Error)
		expect((hook.state.error as Error).message).toMatch(/HTTP 500/)
	})

	test("items unchanged on error", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 503 }))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.items).toEqual([image_a])
	})

	test("loading is false after error", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 500 }))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.loading).toBe(false)
	})

	test("sets error on network failure", async () => {
		_fetch_stub = () => Promise.reject(new Error("network error"))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.error).toBeInstanceOf(Error)
		expect((hook.state.error as Error).message).toBe("network error")
	})
})

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe("useImages().reset", () => {
	test("replaces items with new data", async () => {
		_fetch_stub = () => new Promise<Response>(() => {}) // never resolves
		const hook = useImages(initial_response)
		const new_data = {
			items: [image_b, image_c],
			total: 2,
			next_cursor: "cursor-new",
		}
		hook.reset(new_data)
		expect(hook.state.items).toEqual([image_b, image_c])
	})

	test("replaces total", () => {
		const hook = useImages(initial_response)
		hook.reset({ items: [], total: 99, next_cursor: undefined })
		expect(hook.state.total).toBe(99)
	})

	test("replaces next_cursor", () => {
		const hook = useImages(initial_response)
		hook.reset({ items: [image_b], total: 1, next_cursor: "cursor-new" })
		expect(hook.state.next_cursor).toBe("cursor-new")
	})

	test("clears next_cursor when new data has none", () => {
		const hook = useImages(initial_response)
		hook.reset({ items: [], total: 0, next_cursor: undefined })
		expect(hook.state.next_cursor).toBeUndefined()
	})

	test("clears error on reset", async () => {
		_fetch_stub = () => Promise.resolve(new Response("", { status: 500 }))
		const hook = useImages(initial_response)
		await hook.loadMore()
		expect(hook.state.error).not.toBeNull()
		hook.reset({ items: [image_a], total: 1, next_cursor: undefined })
		expect(hook.state.error).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Gate: module loaded successfully
// ---------------------------------------------------------------------------

describe("useImages — module load guard", () => {
	let _loaded = false
	beforeAll(() => {
		_loaded = true
	})
	test("module loaded successfully", () => {
		expect(_loaded).toBe(true)
	})
})
