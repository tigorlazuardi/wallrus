/**
 * Route tests for GET/POST /api/v1/subscriptions/[id]/devices.
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
import { GET, POST } from "../../../../../../../routes/api/v1/subscriptions/[id]/devices/+server"

const MOCK_SOURCE_SLUG = "mock-source"
const VALID_CREATE = {
	source_slug: MOCK_SOURCE_SLUG,
	name: "Devices Test Sub",
	input_params: {},
	cron: "*/5 * * * *",
}
const DEFAULT_CRITERIA = { nsfw: "all" as const }

function make_event(subscription_id: string, opts: { method?: string; body?: unknown } = {}) {
	const url = new URL(`http://localhost/api/v1/subscriptions/${subscription_id}/devices`)
	const request = new Request(url.toString(), {
		method: opts.method ?? "GET",
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
	})
	return {
		url,
		request,
		params: { id: subscription_id },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/subscriptions/[id]/devices" },
	}
}

let db: ReturnType<typeof create_test_db>
let sub_svc: SubscriptionService
let dev_svc: DeviceService

beforeEach(() => {
	db = create_test_db()
	sub_svc = new SubscriptionService({ db })
	dev_svc = new DeviceService({ db })
	const services = { devices: dev_svc, subscriptions: sub_svc, images: new ImageService({ db }) }
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

describe("GET /api/v1/subscriptions/[id]/devices", () => {
	test("returns empty list for subscription with no linked devices", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await GET(make_event(sub.id) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toMatchObject({ items: [], total: 0 })
	})

	test("returns linked devices", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const dev = await dev_svc.createDevice({
			slug: "phone",
			name: "Phone",
			filter_criteria: DEFAULT_CRITERIA,
		})
		await sub_svc.linkDevice({ subscription_id: sub.id, device_id: dev.id })

		const res = await GET(make_event(sub.id) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].id).toBe(dev.id)
	})
})

describe("POST /api/v1/subscriptions/[id]/devices", () => {
	test("links device, returns 201 with link DTO", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const dev = await dev_svc.createDevice({
			slug: "tablet",
			name: "Tablet",
			filter_criteria: DEFAULT_CRITERIA,
		})

		const res = await POST(
			make_event(sub.id, { method: "POST", body: { device_id: dev.id } }) as never,
		)
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.subscription_id).toBe(sub.id)
		expect(body.device_id).toBe(dev.id)
	})

	test("duplicate link returns 409", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const dev = await dev_svc.createDevice({
			slug: "watch",
			name: "Watch",
			filter_criteria: DEFAULT_CRITERIA,
		})
		await sub_svc.linkDevice({ subscription_id: sub.id, device_id: dev.id })

		const res = await POST(
			make_event(sub.id, { method: "POST", body: { device_id: dev.id } }) as never,
		)
		expect(res.status).toBe(409)
	})

	test("missing device_id returns 400", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await POST(make_event(sub.id, { method: "POST", body: {} }) as never)
		expect(res.status).toBe(400)
	})

	test("unknown device_id returns 404", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await POST(
			make_event(sub.id, {
				method: "POST",
				body: { device_id: "00000000-0000-7000-8000-000000000001" },
			}) as never,
		)
		expect(res.status).toBe(404)
	})

	test("non-JSON body returns 400", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const url = new URL(`http://localhost/api/v1/subscriptions/${sub.id}/devices`)
		const request = new Request(url.toString(), {
			method: "POST",
			body: "bad",
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
			route: { id: "/api/v1/subscriptions/[id]/devices" },
		}
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
