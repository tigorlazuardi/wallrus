/**
 * Route tests for GET /api/v1/devices and POST /api/v1/devices.
 *
 * Pattern: set the runtime singleton with a real DeviceService backed by
 * an in-memory DB; call the exported handler directly with a minimal
 * RequestEvent-shaped object; assert status + response body.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { GET, POST } from "../../../../../routes/api/v1/devices/+server"

// Minimal stub that satisfies RequestEvent
function make_event(opts: { method?: string; body?: unknown; search?: string } = {}) {
	const url = new URL(`http://localhost/api/v1/devices${opts.search ?? ""}`)
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
		route: { id: "/api/v1/devices" },
	}
}

const default_criteria = { nsfw: "all" as const }

let db: ReturnType<typeof create_test_db>

beforeEach(() => {
	db = create_test_db()
	const services = {
		devices: new DeviceService({ db }),
		subscriptions: new SubscriptionService({ db }),
		images: new ImageService({ db }),
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("GET /api/v1/devices", () => {
	test("empty list returns paginated shape", async () => {
		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ items: [], total: 0 })
	})

	test("populated list returns all devices", async () => {
		const svc = new DeviceService({ db })
		await svc.createDevice({ slug: "phone", name: "Phone", filter_criteria: default_criteria })
		await svc.createDevice({
			slug: "tablet",
			name: "Tablet",
			filter_criteria: default_criteria,
		})

		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(2)
		expect(body.items).toHaveLength(2)
	})

	test("enabled=true filters to only enabled devices", async () => {
		const svc = new DeviceService({ db })
		await svc.createDevice({ slug: "on", name: "On", filter_criteria: default_criteria })
		const off = await svc.createDevice({
			slug: "off",
			name: "Off",
			filter_criteria: default_criteria,
		})
		await svc.toggleDevice({ id: off.id, enabled: false })

		const event = make_event({ search: "?enabled=true" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].slug).toBe("on")
	})

	test("enabled=false filters to only disabled devices", async () => {
		const svc = new DeviceService({ db })
		const d = await svc.createDevice({
			slug: "disabled",
			name: "Disabled",
			filter_criteria: default_criteria,
		})
		await svc.toggleDevice({ id: d.id, enabled: false })
		await svc.createDevice({
			slug: "active",
			name: "Active",
			filter_criteria: default_criteria,
		})

		const event = make_event({ search: "?enabled=false" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.total).toBe(1)
		expect(body.items[0].slug).toBe("disabled")
	})

	test("enabled with invalid value returns 400", async () => {
		const event = make_event({ search: "?enabled=maybe" })
		const res = await GET(event as never)
		expect(res.status).toBe(400)
	})
})

describe("POST /api/v1/devices", () => {
	test("creates device, returns 201 with full DTO", async () => {
		const event = make_event({
			method: "POST",
			body: { slug: "new-device", name: "New Device", filter_criteria: default_criteria },
		})
		const res = await POST(event as never)
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.slug).toBe("new-device")
		expect(body.name).toBe("New Device")
		expect(body.enabled).toBe(true)
		expect(typeof body.id).toBe("string")
	})

	test("missing required fields returns 400", async () => {
		const event = make_event({ method: "POST", body: { slug: "x" } }) // missing name
		const res = await POST(event as never)
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.code).toBe("validation.body")
	})

	test("invalid slug returns 400", async () => {
		const event = make_event({
			method: "POST",
			body: { slug: "INVALID SLUG!", name: "Bad" },
		})
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})

	test("slug collision returns 409", async () => {
		const svc = new DeviceService({ db })
		await svc.createDevice({ slug: "taken", name: "First", filter_criteria: default_criteria })

		const event = make_event({
			method: "POST",
			body: { slug: "taken", name: "Second", filter_criteria: default_criteria },
		})
		const res = await POST(event as never)
		expect(res.status).toBe(409)
	})

	test("non-JSON body returns 400", async () => {
		const url = new URL("http://localhost/api/v1/devices")
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
			route: { id: "/api/v1/devices" },
		}
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
