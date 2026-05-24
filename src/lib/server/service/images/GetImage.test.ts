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

describe("getImage", () => {
	test("happy path: returns image DTO for existing id", async () => {
		const result = await svc.getImage({ id: IMG.i01 })
		expect(result.id).toBe(IMG.i01)
		expect(result.source_slug).toBe("reddit")
		expect(result.nsfw).toBe("sfw")
	})

	test("returns favorited=true for favorited image", async () => {
		const result = await svc.getImage({ id: IMG.i01 })
		expect(result.favorited).toBe(true)
	})

	test("returns favorited=false for non-favorited image", async () => {
		const result = await svc.getImage({ id: IMG.i03 })
		expect(result.favorited).toBe(false)
	})

	test("returns tags_user for image with user tags", async () => {
		const result = await svc.getImage({ id: IMG.i01 })
		expect(result.tags_user).toContain("landscape")
		expect(result.tags_user).toContain("nature")
	})

	test("throws 404 for unknown id", async () => {
		try {
			await svc.getImage({ id: "00000000-0000-7000-8000-000000000000" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("throws 404 for soft-deleted image when include_deleted=false (default)", async () => {
		try {
			await svc.getImage({ id: IMG.i16 })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("include_deleted=true returns soft-deleted image", async () => {
		const result = await svc.getImage({ id: IMG.i16, include_deleted: true })
		expect(result.id).toBe(IMG.i16)
		expect(result.deleted_at).not.toBeNull()
	})

	test("returns blacklisted image (no visibility check on blacklisted)", async () => {
		// getImage does not filter blacklisted — only checks deleted_at
		const result = await svc.getImage({ id: IMG.i17 })
		expect(result.id).toBe(IMG.i17)
		expect(result.blacklisted_at).not.toBeNull()
	})
})
