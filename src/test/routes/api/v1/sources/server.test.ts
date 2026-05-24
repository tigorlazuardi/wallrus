/**
 * Route tests for GET /api/v1/sources.
 *
 * Pattern mirrors src/test/routes/api/v1/devices/server.test.ts:
 * call the exported handler directly with a minimal RequestEvent-shaped
 * object; assert status + response body shape.
 *
 * The sources endpoint does NOT require the runtime singleton — it reads
 * directly from the registry. Tests seed the registry with a stub source,
 * then restore the original state after each test.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { sources, register } from "$lib/server/sources/_registry"
import { GET } from "../../../../../routes/api/v1/sources/+server"

// Minimal stub that satisfies RequestEvent
function make_event() {
	const url = new URL("http://localhost/api/v1/sources")
	const request = new Request(url.toString(), { method: "GET" })
	return {
		url,
		request,
		params: {},
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/sources" },
	}
}

// Capture the registry keys before each test so we can restore afterwards.
let keys_before: string[]

beforeEach(() => {
	keys_before = Object.keys(sources)
})

afterEach(() => {
	// Remove any slugs added during the test.
	for (const key of Object.keys(sources)) {
		if (!keys_before.includes(key)) {
			delete sources[key]
		}
	}
})

describe("GET /api/v1/sources", () => {
	test("returns 200 with items array", async () => {
		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toHaveProperty("items")
		expect(Array.isArray(body.items)).toBe(true)
	})

	test("each item has slug and display_name", async () => {
		// Seed a stub source
		register({
			slug: "test-source",
			display_name: "Test Source",
			params_schema: {} as never,
			async *fetch() {},
		})

		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()

		const item = body.items.find((i: { slug: string }) => i.slug === "test-source")
		expect(item).toBeDefined()
		expect(item.slug).toBe("test-source")
		expect(item.display_name).toBe("Test Source")
	})

	test("does not include extra fields beyond slug and display_name", async () => {
		register({
			slug: "lean-source",
			display_name: "Lean Source",
			params_schema: {} as never,
			async *fetch() {},
		})

		const event = make_event()
		const res = await GET(event as never)
		const body = await res.json()

		const item = body.items.find((i: { slug: string }) => i.slug === "lean-source")
		expect(item).toBeDefined()
		// Only slug and display_name — no params_schema, fetch, credential, etc.
		expect(Object.keys(item).sort()).toEqual(["display_name", "slug"])
	})
})
