import { beforeEach, describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { ImageService } from "./index"

let db: ReturnType<typeof create_test_db>
let svc: ImageService

beforeEach(() => {
	db = create_test_db()
	svc = new ImageService({ db })
	seed_images(db)
})

describe("blacklistImage", () => {
	test("sets blacklisted_at on an existing image", async () => {
		const before = Date.now()
		const result = await svc.blacklistImage({ id: IMG.i04 })
		const after = Date.now()
		expect(result.id).toBe(IMG.i04)
		expect(result.blacklisted_at).not.toBeNull()
		expect(result.blacklisted_at!).toBeGreaterThanOrEqual(before)
		expect(result.blacklisted_at!).toBeLessThanOrEqual(after)
	})

	test("blacklisted image is hidden from listImages by default", async () => {
		await svc.blacklistImage({ id: IMG.i04 })
		const list = await svc.listImages({ offset: 0, limit: 50 })
		const ids = list.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i04)
	})

	test("blacklisted image is visible with include_blacklisted=true", async () => {
		await svc.blacklistImage({ id: IMG.i04 })
		const list = await svc.listImages({ offset: 0, limit: 50, include_blacklisted: true })
		const ids = list.items.map((i) => i.id)
		expect(ids).toContain(IMG.i04)
	})

	test("clears favorites when blacklisting a favorited image", async () => {
		// i01 is favorited in seed
		await svc.blacklistImage({ id: IMG.i01 })
		const result = await svc.getImage({ id: IMG.i01 })
		expect(result.favorited).toBe(false)
	})

	test("clears user tags when blacklisting an image with tags", async () => {
		// i01 has "landscape" and "nature" user tags
		await svc.blacklistImage({ id: IMG.i01 })
		const result = await svc.getImage({ id: IMG.i01 })
		expect(result.tags_user).toHaveLength(0)
	})

	test("throws 404 for unknown id", async () => {
		try {
			await svc.blacklistImage({ id: "00000000-0000-7000-8000-000000000000" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("can blacklist an already-blacklisted image (idempotent)", async () => {
		// i17 is already blacklisted in seed
		const result = await svc.blacklistImage({ id: IMG.i17 })
		expect(result.blacklisted_at).not.toBeNull()
	})
})
