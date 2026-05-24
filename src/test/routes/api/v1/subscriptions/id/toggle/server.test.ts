/**
 * Route tests for POST /api/v1/subscriptions/[id]/toggle.
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
import { POST } from "../../../../../../../routes/api/v1/subscriptions/[id]/toggle/+server"

const MOCK_SOURCE_SLUG = "mock-source"
const VALID_CREATE = {
	source_slug: MOCK_SOURCE_SLUG,
	name: "Toggle Sub",
	input_params: {},
	cron: "*/5 * * * *",
}

function make_toggle_event(id: string, body?: unknown) {
	const url = new URL(`http://localhost/api/v1/subscriptions/${id}/toggle`)
	const request = new Request(url.toString(), {
		method: "POST",
		body: body !== undefined ? JSON.stringify(body) : undefined,
		headers: body !== undefined ? { "content-type": "application/json" } : {},
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
		route: { id: "/api/v1/subscriptions/[id]/toggle" },
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

describe("POST /api/v1/subscriptions/[id]/toggle", () => {
	test("toggles subscription to disabled, returns 200 with DTO", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await POST(make_toggle_event(sub.id, { enabled: false }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.enabled).toBe(false)
		expect(body.id).toBe(sub.id)
	})

	test("toggles subscription to enabled, returns 200 with DTO", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		await sub_svc.toggleSubscription({ id: sub.id, enabled: false })

		const res = await POST(make_toggle_event(sub.id, { enabled: true }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.enabled).toBe(true)
	})

	test("missing enabled field returns 400", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const res = await POST(make_toggle_event(sub.id, {}) as never)
		expect(res.status).toBe(400)
	})

	test("returns 404 for unknown id", async () => {
		const res = await POST(
			make_toggle_event("00000000-0000-7000-8000-000000000001", { enabled: false }) as never,
		)
		expect(res.status).toBe(404)
	})

	test("non-JSON body returns 400", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const url = new URL(`http://localhost/api/v1/subscriptions/${sub.id}/toggle`)
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
			route: { id: "/api/v1/subscriptions/[id]/toggle" },
		}
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
