/**
 * Route tests for DELETE /api/v1/images/[id]/tags/[tag].
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { DELETE } from "../../../../../../../../routes/api/v1/images/[id]/tags/[tag]/+server"

function make_event(id: string, tag: string) {
	const url = new URL(`http://localhost/api/v1/images/${id}/tags/${encodeURIComponent(tag)}`)
	const request = new Request(url.toString(), { method: "DELETE" })
	return {
		url,
		request,
		params: { id, tag },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/images/[id]/tags/[tag]" },
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

describe("DELETE /api/v1/images/[id]/tags/[tag]", () => {
	test("removes an existing tag and returns 204", async () => {
		// i01 has "landscape" and "nature" tags from seed
		const event = make_event(IMG.i01, "landscape")
		const res = await DELETE(event as never)
		expect(res.status).toBe(204)
	})

	test("returns 404 when tag does not exist on the image", async () => {
		const event = make_event(IMG.i01, "nonexistent-tag")
		const res = await DELETE(event as never)
		expect(res.status).toBe(404)
	})
})
