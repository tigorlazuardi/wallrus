/**
 * Route tests for GET/PATCH/DELETE /api/v1/subscriptions/[id].
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
import { GET, PATCH, DELETE } from "../../../../../../routes/api/v1/subscriptions/[id]/+server"

const MOCK_SOURCE_SLUG = "mock-source"
const VALID_CREATE = {
	source_slug: MOCK_SOURCE_SLUG,
	name: "My Sub",
	input_params: {},
	cron: "*/5 * * * *",
}

function make_event(id: string, opts: { method?: string; body?: unknown } = {}) {
	const url = new URL(`http://localhost/api/v1/subscriptions/${id}`)
	const request = new Request(url.toString(), {
		method: opts.method ?? "GET",
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
	})
	return {
		url,
		request,
		params: { id },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/subscriptions/[id]" },
	}
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

describe("GET /api/v1/subscriptions/[id]", () => {
	test("returns subscription by id", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await GET(make_event(sub.id) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(sub.id)
		expect(body.name).toBe("My Sub")
	})

	test("returns 404 for unknown id", async () => {
		const res = await GET(make_event("00000000-0000-7000-8000-000000000001") as never)
		expect(res.status).toBe(404)
	})
})

describe("PATCH /api/v1/subscriptions/[id]", () => {
	test("updates subscription name", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await PATCH(
			make_event(sub.id, { method: "PATCH", body: { name: "Updated Name" } }) as never,
		)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.name).toBe("Updated Name")
	})

	test("returns 404 for unknown id", async () => {
		const res = await PATCH(
			make_event("00000000-0000-7000-8000-000000000001", {
				method: "PATCH",
				body: { name: "x" },
			}) as never,
		)
		expect(res.status).toBe(404)
	})

	test("returns 400 for invalid JSON body", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const url = new URL(`http://localhost/api/v1/subscriptions/${sub.id}`)
		const request = new Request(url.toString(), {
			method: "PATCH",
			body: "bad json",
			headers: { "content-type": "text/plain" },
		})
		const event = {
			url,
			request,
			params: { id: sub.id },
			locals: {},
			cookies: {},
			fetch: globalThis.fetch,
			getClientAddress: () => "127.0.0.1",
			platform: undefined,
			setHeaders: () => {},
			isDataRequest: false,
			isSubRequest: false,
			route: { id: "/api/v1/subscriptions/[id]" },
		}
		const res = await PATCH(event as never)
		expect(res.status).toBe(400)
	})
})

describe("DELETE /api/v1/subscriptions/[id]", () => {
	test("soft-deletes subscription, returns 204", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await DELETE(make_event(sub.id, { method: "DELETE" }) as never)
		expect(res.status).toBe(204)
	})

	test("returns 404 for unknown id", async () => {
		const res = await DELETE(
			make_event("00000000-0000-7000-8000-000000000001", { method: "DELETE" }) as never,
		)
		expect(res.status).toBe(404)
	})
})
