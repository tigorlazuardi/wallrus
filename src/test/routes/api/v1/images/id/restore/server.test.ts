/**
 * Route tests for POST /api/v1/images/[id]/restore.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { POST } from "../../../../../../../routes/api/v1/images/[id]/restore/+server"

function make_event(id: string) {
	const url = new URL(`http://localhost/api/v1/images/${id}/restore`)
	const request = new Request(url.toString(), { method: "POST" })
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
		route: { id: "/api/v1/images/[id]/restore" },
	}
}

let db: ReturnType<typeof create_test_db>

beforeEach(() => {
	db = create_test_db()
	const services = {
		devices: new DeviceService({ db }),
		subscriptions: new SubscriptionService({ db }),
		images: new ImageService({ db }),
		runs: {} as never,
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)
	seed_images(db)
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("POST /api/v1/images/[id]/restore", () => {
	test("restores a soft-deleted image and returns 200", async () => {
		// i16 is soft-deleted in seed
		const event = make_event(IMG.i16)
		const res = await POST(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(IMG.i16)
		expect(body.deleted_at).toBeNull()
	})

	test("returns 400 with validation.blacklisted when restoring a blacklisted image", async () => {
		// i17 is blacklisted in seed
		const event = make_event(IMG.i17)
		const res = await POST(event as never)
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.code).toBe("validation.blacklisted")
	})

	test("returns 404 for nonexistent image", async () => {
		const event = make_event("01900000-dead-7000-8000-000000000000")
		const res = await POST(event as never)
		expect(res.status).toBe(404)
	})
})
