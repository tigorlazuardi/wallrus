/**
 * Route tests for GET /api/v1/images.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { GET } from "../../../../../routes/api/v1/images/+server"

function make_event(opts: { search?: string } = {}) {
	const url = new URL(`http://localhost/api/v1/images${opts.search ?? ""}`)
	const request = new Request(url.toString(), { method: "GET" })
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
		route: { id: "/api/v1/images" },
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
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("GET /api/v1/images", () => {
	test("empty DB returns empty list", async () => {
		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(0)
		expect(body.total).toBe(0)
	})

	test("populated DB returns paginated list (excludes deleted + blacklisted by default)", async () => {
		seed_images(db)
		const event = make_event()
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		// 20 total - 1 deleted (i16) - 1 blacklisted (i17) = 18
		expect(body.total).toBe(18)
	})

	test("source_slug filter returns only matching images", async () => {
		seed_images(db)
		const event = make_event({ search: "?source_slug=booru" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		// booru images: i08,i09,i10,i14,i15,i19,i20 (7); but i19 is visible (not deleted/blacklisted)
		expect(
			body.items.every((img: { source_slug: string }) => img.source_slug === "booru"),
		).toBe(true)
	})

	test("nsfw=sfw_only filters out nsfw and unknown images", async () => {
		seed_images(db)
		const event = make_event({ search: "?nsfw=sfw_only" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items.every((img: { nsfw: string }) => img.nsfw === "sfw")).toBe(true)
	})

	test("nsfw=nsfw_only returns only nsfw images", async () => {
		seed_images(db)
		const event = make_event({ search: "?nsfw=nsfw_only" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items.every((img: { nsfw: string }) => img.nsfw === "nsfw")).toBe(true)
		expect(body.total).toBe(2) // i06, i07
	})

	test("favorited=true returns only favorited images", async () => {
		seed_images(db)
		const event = make_event({ search: "?favorited=true" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items.every((img: { favorited: boolean }) => img.favorited === true)).toBe(true)
		expect(body.total).toBe(3) // i01, i02, i11
	})

	test("include_deleted=true shows soft-deleted images", async () => {
		seed_images(db)
		const event = make_event({ search: "?include_deleted=true" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		const ids = body.items.map((img: { id: string }) => img.id)
		expect(ids).toContain(IMG.i16)
	})

	test("search filter returns matching images via FTS5", async () => {
		seed_images(db)
		// i18 has search_text "cat on a roof"; i19 has "dog in the park"
		const event = make_event({ search: "?search=cat" })
		const res = await GET(event as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].id).toBe(IMG.i18)
	})

	test("invalid nsfw value returns 400", async () => {
		const event = make_event({ search: "?nsfw=badvalue" })
		const res = await GET(event as never)
		expect(res.status).toBe(400)
	})

	test("invalid favorited value returns 400", async () => {
		const event = make_event({ search: "?favorited=maybe" })
		const res = await GET(event as never)
		expect(res.status).toBe(400)
	})
})
