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

describe("addTag", () => {
	test("happy path: adds a tag to an image", async () => {
		const result = await svc.addTag({ image_id: IMG.i04, tag: "sunset" })
		expect(result.image_id).toBe(IMG.i04)
		expect(result.tag).toBe("sunset")
		expect(result.created_at).toBeGreaterThan(0)
	})

	test("normalises tag to lowercase", async () => {
		const result = await svc.addTag({ image_id: IMG.i04, tag: "SunSet" })
		expect(result.tag).toBe("sunset")
	})

	test("normalises tag: trims whitespace", async () => {
		const result = await svc.addTag({ image_id: IMG.i04, tag: "  forest  " })
		expect(result.tag).toBe("forest")
	})

	test("idempotent: adding the same tag twice returns the same row", async () => {
		const first = await svc.addTag({ image_id: IMG.i04, tag: "landscape" })
		const second = await svc.addTag({ image_id: IMG.i04, tag: "landscape" })
		// created_at should be the same (from the first insert)
		expect(second.tag).toBe("landscape")
		expect(second.created_at).toBe(first.created_at)
	})

	test("idempotent: case variant is treated as same tag", async () => {
		const first = await svc.addTag({ image_id: IMG.i04, tag: "City" })
		const second = await svc.addTag({ image_id: IMG.i04, tag: "city" })
		expect(second.tag).toBe("city")
		expect(second.created_at).toBe(first.created_at)
	})

	test("throws 404 for unknown image_id", async () => {
		try {
			await svc.addTag({ image_id: "00000000-0000-7000-8000-000000000000", tag: "test" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})

	test("throws 400 for empty tag (after trim)", async () => {
		try {
			await svc.addTag({ image_id: IMG.i04, tag: "   " })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(400)
		}
	})

	test("added tag appears in getImage tags_user", async () => {
		await svc.addTag({ image_id: IMG.i04, tag: "mountains" })
		const image = await svc.getImage({ id: IMG.i04 })
		expect(image.tags_user).toContain("mountains")
	})
})
