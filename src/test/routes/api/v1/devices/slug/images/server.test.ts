/**
 * Route tests for GET /api/v1/devices/[slug]/images.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images } from "$test/fixtures/seed_images"
import { GET } from "../../../../../../../routes/api/v1/devices/[slug]/images/+server"

function make_event(slug: string, opts: { search?: string } = {}) {
	const url = new URL(`http://localhost/api/v1/devices/${slug}/images${opts.search ?? ""}`)
	const request = new Request(url.toString(), { method: "GET" })
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
		route: { id: "/api/v1/devices/[slug]/images" },
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

describe("GET /api/v1/devices/[slug]/images", () => {
	test("returns paginated image list for existing device slug", async () => {
		// device-a has i01..i10 (10 images; i16 and i17 are on device-b)
		const event = make_event("device-a")
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		// device-a has i01-i10 (10 images, none deleted or blacklisted)
		expect(body.total).toBe(10)
		expect(body.items).toHaveLength(10)
	})

	test("returns 404 when device slug does not exist", async () => {
		const event = make_event("nonexistent-device")
		const res = await GET(event as never)
		expect(res.status).toBe(404)
	})

	test("filters by source_slug within device scope", async () => {
		// device-a: i01-i05 (reddit/sfw), i06-i07 (reddit/nsfw), i08-i10 (booru/sfw)
		const event = make_event("device-a", { search: "?source_slug=booru" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(
			body.items.every((img: { source_slug: string }) => img.source_slug === "booru"),
		).toBe(true)
		expect(body.total).toBe(3) // i08, i09, i10
	})
})
