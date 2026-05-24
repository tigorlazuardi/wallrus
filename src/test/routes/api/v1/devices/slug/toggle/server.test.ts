/**
 * Route tests for POST /api/v1/devices/[slug]/toggle.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { POST } from "../../../../../../../routes/api/v1/devices/[slug]/toggle/+server"

const default_criteria = { nsfw: "all" as const }

function make_event(slug: string, body: unknown) {
	const url = new URL(`http://localhost/api/v1/devices/${slug}/toggle`)
	const request = new Request(url.toString(), {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
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
		route: { id: "/api/v1/devices/[slug]/toggle" },
	}
}

let db: ReturnType<typeof create_test_db>
let svc: DeviceService

beforeEach(() => {
	db = create_test_db()
	svc = new DeviceService({ db })
	const services = { devices: svc }
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("POST /api/v1/devices/[slug]/toggle", () => {
	test("disables device by slug, returns updated DTO", async () => {
		await svc.createDevice({ slug: "tv", name: "TV", filter_criteria: default_criteria })
		const event = make_event("tv", { enabled: false })
		const res = await POST(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.enabled).toBe(false)
		expect(body.slug).toBe("tv")
	})

	test("enables device by id", async () => {
		const created = await svc.createDevice({
			slug: "camera",
			name: "Camera",
			filter_criteria: default_criteria,
		})
		// First disable
		await svc.toggleDevice({ id: created.id, enabled: false })
		// Now re-enable via route
		const event = make_event(created.id, { enabled: true })
		const res = await POST(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.enabled).toBe(true)
	})

	test("returns 404 for unknown device slug", async () => {
		const event = make_event("ghost", { enabled: false })
		const res = await POST(event as never)
		expect(res.status).toBe(404)
	})

	test("returns 400 for missing enabled field", async () => {
		await svc.createDevice({
			slug: "laptop",
			name: "Laptop",
			filter_criteria: default_criteria,
		})
		const event = make_event("laptop", {})
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})

	test("returns 400 for non-boolean enabled", async () => {
		await svc.createDevice({
			slug: "desktop",
			name: "Desktop",
			filter_criteria: default_criteria,
		})
		const event = make_event("desktop", { enabled: "yes" })
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
