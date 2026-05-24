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

describe("softDeleteImage", () => {
	test("sets deleted_at on an existing image", async () => {
		const result = await svc.softDeleteImage({ id: IMG.i04 })
		expect(result.id).toBe(IMG.i04)
		expect(result.deleted_at).not.toBeNull()
		expect(result.deleted_at).toBeGreaterThan(0)
	})

	test("soft-deleted image is hidden from listImages by default", async () => {
		await svc.softDeleteImage({ id: IMG.i04 })
		const list = await svc.listImages({ offset: 0, limit: 50 })
		const ids = list.items.map((i) => i.id)
		expect(ids).not.toContain(IMG.i04)
	})

	test("soft-deleted image is visible with include_deleted=true", async () => {
		await svc.softDeleteImage({ id: IMG.i04 })
		const list = await svc.listImages({ offset: 0, limit: 50, include_deleted: true })
		const ids = list.items.map((i) => i.id)
		expect(ids).toContain(IMG.i04)
	})

	test("returns the image DTO (with deleted_at set)", async () => {
		const before = Date.now()
		const result = await svc.softDeleteImage({ id: IMG.i04 })
		const after = Date.now()
		expect(result.deleted_at).toBeGreaterThanOrEqual(before)
		expect(result.deleted_at).toBeLessThanOrEqual(after)
	})

	test("throws 404 for unknown id", async () => {
		try {
			await svc.softDeleteImage({ id: "00000000-0000-7000-8000-000000000000" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("can soft-delete an already-soft-deleted image (idempotent)", async () => {
		// i16 is already soft-deleted in seed
		const result = await svc.softDeleteImage({ id: IMG.i16 })
		expect(result.deleted_at).not.toBeNull()
	})
})
