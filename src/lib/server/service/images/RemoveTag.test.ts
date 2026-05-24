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

describe("removeTag", () => {
	test("removes an existing tag from image", async () => {
		// i01 has "landscape" from seed
		const result = await svc.removeTag({ image_id: IMG.i01, tag: "landscape" })
		expect(result.success).toBe(true)

		// Verify it's gone
		const image = await svc.getImage({ id: IMG.i01 })
		expect(image.tags_user).not.toContain("landscape")
	})

	test("normalises tag to lowercase before removal", async () => {
		// i01 has "landscape" from seed
		const result = await svc.removeTag({ image_id: IMG.i01, tag: "LANDSCAPE" })
		expect(result.success).toBe(true)
	})

	test("throws 404 if tag does not exist on image", async () => {
		try {
			await svc.removeTag({ image_id: IMG.i04, tag: "nonexistent" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("throws 404 for unknown image_id", async () => {
		try {
			await svc.removeTag({
				image_id: "00000000-0000-7000-8000-000000000000",
				tag: "landscape",
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("leaves other tags intact after removal", async () => {
		// i01 has "landscape" and "nature"
		await svc.removeTag({ image_id: IMG.i01, tag: "landscape" })
		const image = await svc.getImage({ id: IMG.i01 })
		expect(image.tags_user).toContain("nature")
		expect(image.tags_user).not.toContain("landscape")
	})
})
