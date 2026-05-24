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

describe("toggleFavorite", () => {
	test("favorites a non-favorited image", async () => {
		// i04 is not favorited in seed
		const result = await svc.toggleFavorite({ image_id: IMG.i04, favorited: true })
		expect(result.id).toBe(IMG.i04)
		expect(result.favorited).toBe(true)
	})

	test("unfavorites a favorited image", async () => {
		// i01 is favorited in seed
		const result = await svc.toggleFavorite({ image_id: IMG.i01, favorited: false })
		expect(result.id).toBe(IMG.i01)
		expect(result.favorited).toBe(false)
	})

	test("favoriting an already-favorited image is idempotent", async () => {
		// i01 already favorited
		const result = await svc.toggleFavorite({ image_id: IMG.i01, favorited: true })
		expect(result.favorited).toBe(true)
	})

	test("unfavoriting a non-favorited image is idempotent", async () => {
		// i04 not favorited
		const result = await svc.toggleFavorite({ image_id: IMG.i04, favorited: false })
		expect(result.favorited).toBe(false)
	})

	test("throws 404 for unknown image_id", async () => {
		try {
			await svc.toggleFavorite({
				image_id: "00000000-0000-7000-8000-000000000000",
				favorited: true,
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})
})
