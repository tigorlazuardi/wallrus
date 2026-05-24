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

describe("restoreImage", () => {
	test("happy path: clears deleted_at on a soft-deleted image", async () => {
		// i16 is soft-deleted in seed
		const result = await svc.restoreImage({ id: IMG.i16 })
		expect(result.id).toBe(IMG.i16)
		expect(result.deleted_at).toBeNull()
	})

	test("restored image appears in default listImages again", async () => {
		await svc.restoreImage({ id: IMG.i16 })
		const list = await svc.listImages({ offset: 0, limit: 50 })
		const ids = list.items.map((i) => i.id)
		expect(ids).toContain(IMG.i16)
	})

	test("can restore a non-deleted image (no-op, returns the image)", async () => {
		// restoreImage on a non-deleted image just clears deleted_at=null -> null
		const result = await svc.restoreImage({ id: IMG.i04 })
		expect(result.deleted_at).toBeNull()
	})

	test("throws 400 when attempting to restore a blacklisted image", async () => {
		// i17 is blacklisted in seed
		try {
			await svc.restoreImage({ id: IMG.i17 })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(400)
		}
	})

	test("throws 404 for unknown id", async () => {
		try {
			await svc.restoreImage({ id: "00000000-0000-7000-8000-000000000000" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})
})
