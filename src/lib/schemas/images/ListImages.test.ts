import { test, expect, describe } from "bun:test"
import { ListImagesRequestSchema } from "./ListImages"

describe("ListImagesRequestSchema", () => {
	test("accepts empty object with defaults", () => {
		const result = ListImagesRequestSchema.parse({})
		expect(result.offset).toBe(0)
		expect(result.limit).toBe(50)
	})

	test("accepts all filters", () => {
		const result = ListImagesRequestSchema.parse({
			next: "some-cursor",
			prev: "prev-cursor",
			offset: 10,
			limit: 100,
			device_id: "01900000-0001-7000-8000-000000000001",
			source_slug: "reddit",
			favorited: true,
			nsfw: "sfw_only",
			include_deleted: true,
			include_blacklisted: false,
			search: "cat on a roof",
		})
		expect(result.search).toBe("cat on a roof")
		expect(result.nsfw).toBe("sfw_only")
		expect(result.favorited).toBe(true)
		expect(result.include_deleted).toBe(true)
		expect(result.include_blacklisted).toBe(false)
	})

	test("accepts all nsfw enum values", () => {
		expect(ListImagesRequestSchema.parse({ nsfw: "all" }).nsfw).toBe("all")
		expect(ListImagesRequestSchema.parse({ nsfw: "sfw_only" }).nsfw).toBe("sfw_only")
		expect(ListImagesRequestSchema.parse({ nsfw: "nsfw_only" }).nsfw).toBe("nsfw_only")
	})

	test("rejects unknown keys", () => {
		expect(() =>
			ListImagesRequestSchema.parse({
				unknown_key: "oops",
			}),
		).toThrow()
	})

	test("rejects invalid nsfw value", () => {
		expect(() =>
			ListImagesRequestSchema.parse({
				nsfw: "safe",
			}),
		).toThrow()
	})

	test("rejects negative offset", () => {
		expect(() =>
			ListImagesRequestSchema.parse({
				offset: -1,
			}),
		).toThrow()
	})

	test("rejects limit out of range", () => {
		expect(() =>
			ListImagesRequestSchema.parse({
				limit: 0,
			}),
		).toThrow()
		expect(() =>
			ListImagesRequestSchema.parse({
				limit: 201,
			}),
		).toThrow()
	})
})
