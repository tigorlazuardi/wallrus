/**
 * Route tests for GET /api/v1/images/[id] and DELETE /api/v1/images/[id].
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { GET, DELETE } from "../../../../../../routes/api/v1/images/[id]/+server"

const NONEXISTENT_ID = "01900000-dead-7000-8000-000000000000"

function make_event(id: string, opts: { method?: string; search?: string } = {}) {
	const url = new URL(`http://localhost/api/v1/images/${id}${opts.search ?? ""}`)
	const request = new Request(url.toString(), {
		method: opts.method ?? "GET",
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
		route: { id: "/api/v1/images/[id]" },
	}
}

let db: ReturnType<typeof create_test_db>

beforeEach(() => {
	db = create_test_db()
	const services = {
		devices: new DeviceService({ db }),
		subscriptions: new SubscriptionService({ db }),
		images: new ImageService({ db }),
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)
	seed_images(db)
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("GET /api/v1/images/[id]", () => {
	test("returns 200 with image DTO for existing image", async () => {
		const event = make_event(IMG.i01)
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(IMG.i01)
		expect(body.source_slug).toBe("reddit")
	})

	test("returns 404 for nonexistent image", async () => {
		const event = make_event(NONEXISTENT_ID)
		const res = await GET(event as never)
		expect(res.status).toBe(404)
	})

	test("soft-deleted image returns 404 by default", async () => {
		const event = make_event(IMG.i16)
		const res = await GET(event as never)
		expect(res.status).toBe(404)
	})

	test("soft-deleted image returns 200 with include_deleted=true", async () => {
		const event = make_event(IMG.i16, { search: "?include_deleted=true" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(IMG.i16)
		expect(body.deleted_at).not.toBeNull()
	})
})

describe("DELETE /api/v1/images/[id]", () => {
	test("soft-deletes image and returns 204", async () => {
		const event = make_event(IMG.i01, { method: "DELETE" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(204)
		// Verify it's soft-deleted: GET should return 404
		const get_event = make_event(IMG.i01)
		const get_res = await GET(get_event as never)
		expect(get_res.status).toBe(404)
	})

	test("blacklists image when ?blacklist=true and returns 204", async () => {
		const event = make_event(IMG.i01, { method: "DELETE", search: "?blacklist=true" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(204)
	})

	test("returns 404 when deleting nonexistent image", async () => {
		const event = make_event(NONEXISTENT_ID, { method: "DELETE" })
		const res = await DELETE(event as never)
		expect(res.status).toBe(404)
	})
})
