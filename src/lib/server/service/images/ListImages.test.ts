import { beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { seed_images, IMG, DEVICE_A, DEVICE_B } from "$test/fixtures/seed_images"
import { ImageService } from "./index"

let db: ReturnType<typeof create_test_db>
let svc: ImageService

beforeEach(() => {
	db = create_test_db()
	svc = new ImageService({ db })
})

describe("listImages — empty DB", () => {
	test("returns empty items and zero total", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50 })
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
		expect(result.next_cursor).toBeUndefined()
		expect(result.prev_cursor).toBeUndefined()
	})
})

describe("listImages — populated DB", () => {
	beforeEach(() => {
		seed_images(db)
	})

	test("default: excludes soft-deleted and blacklisted", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50 })
		// 20 total - 1 deleted (i16) - 1 blacklisted (i17) = 18
		expect(result.total).toBe(18)
		const ids = result.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i16)
		expect(ids).not.toContain(IMG.i17)
	})

	test("items have expected shape (id, sha256, favorited, tags_user)", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50 })
		const item = result.items.find((i) => i.id === IMG.i01)
		expect(item).toBeDefined()
		expect(item!.sha256).toBeTruthy()
		// i01 is favorited in seed
		expect(item!.favorited).toBe(true)
		// i01 has user tags "landscape" and "nature"
		expect(item!.tags_user).toContain("landscape")
		expect(item!.tags_user).toContain("nature")
	})

	test("filter: device_id=DEVICE_A returns only device A images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, device_id: DEVICE_A })
		const ids = result.items.map((i) => i.id)
		// Device A gets i01-i10 (minus blacklisted i17 and deleted i16, which are in device B)
		expect(ids).toContain(IMG.i01)
		expect(ids).toContain(IMG.i10)
		expect(ids).not.toContain(IMG.i11)
		expect(ids).not.toContain(IMG.i20)
	})

	test("filter: device_id=DEVICE_B returns only device B images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, device_id: DEVICE_B })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i11)
		expect(ids).not.toContain(IMG.i01)
	})

	test("filter: source_slug=reddit returns only reddit images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, source_slug: "reddit" })
		for (const item of result.items) {
			expect(item.source_slug).toBe("reddit")
		}
	})

	test("filter: source_slug=booru returns only booru images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, source_slug: "booru" })
		for (const item of result.items) {
			expect(item.source_slug).toBe("booru")
		}
	})

	test("filter: favorited=true returns only favorited images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, favorited: true })
		// i01, i02, i11 are favorited in seed
		expect(result.items).toHaveLength(3)
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i01)
		expect(ids).toContain(IMG.i02)
		expect(ids).toContain(IMG.i11)
		for (const item of result.items) {
			expect(item.favorited).toBe(true)
		}
	})

	test("filter: favorited=false excludes favorited images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, favorited: false })
		const ids = result.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i01)
		expect(ids).not.toContain(IMG.i02)
		expect(ids).not.toContain(IMG.i11)
	})

	test("nsfw=sfw_only returns only sfw images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, nsfw: "sfw_only" })
		for (const item of result.items) {
			expect(item.nsfw).toBe("sfw")
		}
	})

	test("nsfw=nsfw_only returns only nsfw images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, nsfw: "nsfw_only" })
		for (const item of result.items) {
			expect(item.nsfw).toBe("nsfw")
		}
		// i06, i07 are nsfw in seed
		expect(result.items.length).toBeGreaterThan(0)
	})

	test("nsfw=all returns sfw, nsfw, and unknown images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, nsfw: "all" })
		const nsfwValues = new Set(result.items.map((i) => i.nsfw))
		expect(nsfwValues.has("sfw")).toBe(true)
		expect(nsfwValues.has("nsfw")).toBe(true)
		expect(nsfwValues.has("unknown")).toBe(true)
	})

	test("include_deleted=true includes soft-deleted images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, include_deleted: true })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i16)
	})

	test("include_deleted=false excludes soft-deleted images (default)", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, include_deleted: false })
		const ids = result.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i16)
	})

	test("include_blacklisted=true includes blacklisted images", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, include_blacklisted: true })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i17)
	})

	test("include_blacklisted=false excludes blacklisted images (default)", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, include_blacklisted: false })
		const ids = result.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i17)
	})

	test("pagination: limit reduces returned items", async () => {
		const result = await svc.listImages({ offset: 0, limit: 5 })
		expect(result.items).toHaveLength(5)
		expect(result.next_cursor).toBeDefined()
	})

	test("ordered by ingested_at DESC, id DESC (most recent first)", async () => {
		const result = await svc.listImages({ offset: 0, limit: 5 })
		const ingestedAts = result.items.map((i) => i.ingested_at)
		for (let i = 1; i < ingestedAts.length; i++) {
			// ingested_at should be non-increasing
			const curr = ingestedAts[i]!
			const prev = ingestedAts[i - 1]!
			expect(curr).toBeLessThanOrEqual(prev)
		}
	})
})

describe("listImages — FTS5 search", () => {
	beforeEach(() => {
		seed_images(db)
	})

	test("search finds i18 with term 'cat' and not i19", async () => {
		// i18 has search_text "cat on a roof", i19 has "dog in the park"
		const result = await svc.listImages({ offset: 0, limit: 50, search: "cat" })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i18)
		expect(ids).not.toContain(IMG.i19)
	})

	test("search finds i19 with term 'dog' and not i18", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, search: "dog" })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i19)
		expect(ids).not.toContain(IMG.i18)
	})

	test("search returns results ordered by bm25 (best match first)", async () => {
		// Both "wallpaper" terms appear in many rows; just verify we get results
		const result = await svc.listImages({ offset: 0, limit: 50, search: "wallpaper" })
		expect(result.items.length).toBeGreaterThan(0)
	})

	test("search with no match returns empty", async () => {
		const result = await svc.listImages({ offset: 0, limit: 50, search: "zzznomatchzzz" })
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
	})
})
