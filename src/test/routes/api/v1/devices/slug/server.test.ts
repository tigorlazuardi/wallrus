/**
 * Route tests for GET/PATCH/DELETE /api/v1/devices/[slug].
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { GET, PATCH, DELETE } from "../../../../../../routes/api/v1/devices/[slug]/+server"

const default_criteria = { nsfw: "all" as const }

function make_event(slug: string, opts: { method?: string; body?: unknown } = {}) {
	const url = new URL(`http://localhost/api/v1/devices/${slug}`)
	const request = new Request(url.toString(), {
		method: opts.method ?? "GET",
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
	})
	return {
		url,
		request,
		params: { slug },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/devices/[slug]" },
	}
}

let db: ReturnType<typeof create_test_db>
let svc: DeviceService

beforeEach(() => {
	db = create_test_db()
	svc = new DeviceService({ db })
	const services = { devices: svc, subscriptions: new SubscriptionService({ db }) }
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("GET /api/v1/devices/[slug]", () => {
	test("returns device by id", async () => {
		const created = await svc.createDevice({
			slug: "pixel",
			name: "Pixel",
			filter_criteria: default_criteria,
		})
		const event = make_event(created.id)
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(created.id)
		expect(body.slug).toBe("pixel")
	})

	test("returns device by slug", async () => {
		await svc.createDevice({
			slug: "monitor",
			name: "Monitor",
			filter_criteria: default_criteria,
		})
		const event = make_event("monitor")
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.slug).toBe("monitor")
	})

	test("returns 404 for missing device", async () => {
		const event = make_event("nonexistent")
		const res = await GET(event as never)
		expect(res.status).toBe(404)
	})

	test("returns 404 for unknown UUID", async () => {
		const event = make_event("00000000-0000-0000-0000-000000000001")
		const res = await GET(event as never)
		expect(res.status).toBe(404)
	})
})

describe("PATCH /api/v1/devices/[slug]", () => {
	test("updates device name by slug", async () => {
		await svc.createDevice({
			slug: "phone",
			name: "Phone",
			filter_criteria: default_criteria,
		})
		const event = make_event("phone", { method: "PATCH", body: { name: "Pixel 8" } })
		const res = await PATCH(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.name).toBe("Pixel 8")
	})

	test("updates device by id", async () => {
		const created = await svc.createDevice({
			slug: "watch",
			name: "Watch",
			filter_criteria: default_criteria,
		})
		const event = make_event(created.id, { method: "PATCH", body: { name: "Smart Watch" } })
		const res = await PATCH(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.name).toBe("Smart Watch")
	})

	test("returns 404 for missing device", async () => {
		const event = make_event("no-such-device", { method: "PATCH", body: { name: "New Name" } })
		const res = await PATCH(event as never)
		expect(res.status).toBe(404)
	})

	test("returns 400 for invalid JSON body", async () => {
		const url = new URL("http://localhost/api/v1/devices/phone")
		const request = new Request(url.toString(), {
			method: "PATCH",
			body: "oops",
			headers: { "content-type": "text/plain" },
		})
		const event = {
			url,
			request,
			params: { slug: "phone" },
			locals: {},
			cookies: {},
			fetch: globalThis.fetch,
			getClientAddress: () => "127.0.0.1",
			platform: undefined,
			setHeaders: () => {},
			isDataRequest: false,
			isSubRequest: false,
			route: { id: "/api/v1/devices/[slug]" },
		}
		const res = await PATCH(event as never)
		expect(res.status).toBe(400)
	})
})

describe("DELETE /api/v1/devices/[slug]", () => {
	test("deletes device by slug, returns 204", async () => {
		await svc.createDevice({
			slug: "to-delete",
			name: "To Delete",
			filter_criteria: default_criteria,
		})
		const event = make_event("to-delete", { method: "DELETE" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(204)
	})

	test("deletes device by id, returns 204", async () => {
		const created = await svc.createDevice({
			slug: "bye",
			name: "Bye",
			filter_criteria: default_criteria,
		})
		const event = make_event(created.id, { method: "DELETE" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(204)
	})

	test("returns 404 for missing device", async () => {
		const event = make_event("nope", { method: "DELETE" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(404)
	})
})
