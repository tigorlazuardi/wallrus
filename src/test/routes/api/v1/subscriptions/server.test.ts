/**
 * Route tests for GET /api/v1/subscriptions and POST /api/v1/subscriptions.
 *
 * Uses create_test_db() + stubs the runtime singleton.
 * A mock source is registered/removed around each test to satisfy
 * the unknown_source validation in CreateSubscription.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import type { Runtime } from "$lib/server/bootstrap"
import { GET, POST } from "../../../../../routes/api/v1/subscriptions/+server"

function make_event(opts: { method?: string; body?: unknown; search?: string } = {}) {
	const url = new URL(`http://localhost/api/v1/subscriptions${opts.search ?? ""}`)
	const request = new Request(url.toString(), {
		method: opts.method ?? "GET",
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
	})
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
		route: { id: "/api/v1/subscriptions" },
	}
}

const MOCK_SOURCE_SLUG = "mock-source"
const VALID_BODY = {
	source_slug: MOCK_SOURCE_SLUG,
	name: "Test Sub",
	input_params: {},
	cron: "*/5 * * * *",
}

let db: ReturnType<typeof create_test_db>
let sub_svc: SubscriptionService

beforeEach(() => {
	db = create_test_db()
	sub_svc = new SubscriptionService({ db })
	const services = {
		devices: new DeviceService({ db }),
		subscriptions: sub_svc,
		images: new ImageService({ db }),
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)

	// Register mock source so CreateSubscription happy path works
	sources[MOCK_SOURCE_SLUG] = {
		slug: MOCK_SOURCE_SLUG,
		display_name: "Mock Source",
		params_schema: z.object({}).passthrough(),
		async *fetch() {},
	}
})

afterEach(() => {
	delete sources[MOCK_SOURCE_SLUG]
	_reset_runtime_for_tests()
})

describe("GET /api/v1/subscriptions", () => {
	test("empty list returns paginated shape", async () => {
		const res = await GET(make_event() as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toMatchObject({ items: [], total: 0 })
	})

	test("populated list returns all subscriptions", async () => {
		await sub_svc.createSubscription({ ...VALID_BODY, name: "Sub A" })
		await sub_svc.createSubscription({ ...VALID_BODY, name: "Sub B" })

		const res = await GET(make_event() as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(2)
		expect(body.items).toHaveLength(2)
	})

	test("enabled=true filters to only enabled subscriptions", async () => {
		const a = await sub_svc.createSubscription({ ...VALID_BODY, name: "Active" })
		await sub_svc.createSubscription({ ...VALID_BODY, name: "Disabled" })
		// disable the second one via toggleSubscription
		const all = await sub_svc.listSubscriptions({
			limit: 10,
			offset: 0,
			include_deleted: false,
		})
		const second = all.items.find((s) => s.id !== a.id)!
		await sub_svc.toggleSubscription({ id: second.id, enabled: false })

		const res = await GET(make_event({ search: "?enabled=true" }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].id).toBe(a.id)
	})

	test("source_slug filter returns only matching subscriptions", async () => {
		await sub_svc.createSubscription({ ...VALID_BODY, name: "Mock Sub" })
		// Register another source for a second subscription
		sources["other-source"] = {
			slug: "other-source",
			display_name: "Other",
			params_schema: z.object({}).passthrough(),
			async *fetch() {},
		}
		await sub_svc.createSubscription({
			source_slug: "other-source",
			name: "Other Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		delete sources["other-source"]

		const res = await GET(make_event({ search: `?source_slug=${MOCK_SOURCE_SLUG}` }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].source_slug).toBe(MOCK_SOURCE_SLUG)
	})

	test("soft-deleted subscription absent from default list", async () => {
		const sub = await sub_svc.createSubscription(VALID_BODY)
		await sub_svc.deleteSubscription({ id: sub.id })

		const res = await GET(make_event() as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(0)
	})

	test("soft-deleted subscription present with include_deleted=true", async () => {
		const sub = await sub_svc.createSubscription(VALID_BODY)
		await sub_svc.deleteSubscription({ id: sub.id })

		const res = await GET(make_event({ search: "?include_deleted=true" }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].id).toBe(sub.id)
	})

	test("enabled=invalid returns 400", async () => {
		const res = await GET(make_event({ search: "?enabled=maybe" }) as never)
		expect(res.status).toBe(400)
	})
})

describe("POST /api/v1/subscriptions", () => {
	test("creates subscription, returns 201 with full DTO", async () => {
		const res = await POST(make_event({ method: "POST", body: VALID_BODY }) as never)
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.source_slug).toBe(MOCK_SOURCE_SLUG)
		expect(body.name).toBe("Test Sub")
		expect(body.enabled).toBe(true)
		expect(typeof body.id).toBe("string")
	})

	test("missing required fields returns 400", async () => {
		const res = await POST(
			make_event({ method: "POST", body: { source_slug: "mock-source" } }) as never,
		)
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.code).toBe("validation.body")
	})

	test("invalid cron returns 400 (service validation)", async () => {
		const res = await POST(
			make_event({
				method: "POST",
				body: { ...VALID_BODY, cron: "not-a-cron" },
			}) as never,
		)
		expect(res.status).toBe(400)
	})

	test("unknown source_slug returns 400", async () => {
		const res = await POST(
			make_event({
				method: "POST",
				body: { ...VALID_BODY, source_slug: "nonexistent-source" },
			}) as never,
		)
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.code).toBe("validation.unknown_source")
	})

	test("non-JSON body returns 400", async () => {
		const url = new URL("http://localhost/api/v1/subscriptions")
		const request = new Request(url.toString(), {
			method: "POST",
			body: "not-json",
			headers: { "content-type": "text/plain" },
		})
		const event = {
			url,
			request,
			params: {},
			locals: {},
			cookies: {},
			fetch: globalThis.fetch,
			getClientAddress: () => "127.0.0.1",
			platform: undefined,
			setHeaders: () => {},
			isDataRequest: false,
			isSubRequest: false,
			route: { id: "/api/v1/subscriptions" },
		}
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
