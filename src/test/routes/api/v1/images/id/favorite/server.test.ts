/**
 * Route tests for POST /api/v1/images/[id]/favorite.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { POST } from "../../../../../../../routes/api/v1/images/[id]/favorite/+server"

const NONEXISTENT_ID = "01900000-dead-7000-8000-000000000000"

function make_event(id: string, body?: unknown) {
	const url = new URL(`http://localhost/api/v1/images/${id}/favorite`)
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
		route: { id: "/api/v1/images/[id]/favorite" },
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

describe("POST /api/v1/images/[id]/favorite", () => {
	test("favorited=true sets image as favorited", async () => {
		// i03 is not favorited in seed
		const event = make_event(IMG.i03, { favorited: true })
		const res = await POST(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.favorited).toBe(true)
		expect(body.id).toBe(IMG.i03)
	})

	test("favorited=false unfavorites an already-favorited image", async () => {
		// i01 is favorited in seed
		const event = make_event(IMG.i01, { favorited: false })
		const res = await POST(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.favorited).toBe(false)
		expect(body.id).toBe(IMG.i01)
	})

	test("returns 404 for nonexistent image", async () => {
		const event = make_event(NONEXISTENT_ID, { favorited: true })
		const res = await POST(event as never)
		expect(res.status).toBe(404)
	})

	test("missing favorited field returns 400", async () => {
		const event = make_event(IMG.i01, { other: "stuff" })
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})

	test("invalid JSON body returns 400", async () => {
		const url = new URL(`http://localhost/api/v1/images/${IMG.i01}/favorite`)
		const request = new Request(url.toString(), {
			method: "POST",
			body: "not-json",
			headers: { "content-type": "text/plain" },
		})
		const event = {
			url,
			request,
			params: { id: IMG.i01 },
			locals: {},
			cookies: {},
			fetch: globalThis.fetch,
			getClientAddress: () => "127.0.0.1",
			platform: undefined,
			setHeaders: () => {},
			isDataRequest: false,
			isSubRequest: false,
			route: { id: "/api/v1/images/[id]/favorite" },
		}
		const res = await POST(event as never)
		expect(res.status).toBe(400)
	})
})
