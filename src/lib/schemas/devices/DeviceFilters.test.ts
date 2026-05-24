import { describe, expect, test } from "bun:test"
import { DeviceFiltersSchema } from "./DeviceFilters"

describe("DeviceFiltersSchema", () => {
	test("accepts empty object and defaults nsfw to 'all'", () => {
		const result = DeviceFiltersSchema.parse({})
		expect(result.nsfw).toBe("all")
	})

	test("accepts all valid fields", () => {
		const result = DeviceFiltersSchema.parse({
			min_width: 1920,
			max_width: 3840,
			min_height: 1080,
			max_height: 2160,
			aspect_ratio: { target: 1.77, tolerance: 0.05 },
			min_bytes: 1024,
			max_bytes: 10485760,
			formats: ["jpg", "png", "webp", "avif"],
			tags_include: ["nature", "landscape"],
			tags_exclude: ["nsfw"],
			nsfw: "sfw_only",
		})
		expect(result.min_width).toBe(1920)
		expect(result.formats).toEqual(["jpg", "png", "webp", "avif"])
		expect(result.nsfw).toBe("sfw_only")
	})

	test("rejects unknown keys (strict)", () => {
		expect(() =>
			DeviceFiltersSchema.parse({
				unknown_key: "value",
			}),
		).toThrow()
	})

	test("rejects invalid nsfw value", () => {
		expect(() =>
			DeviceFiltersSchema.parse({
				nsfw: "sometimes",
			}),
		).toThrow()
	})

	test("rejects invalid format value", () => {
		expect(() =>
			DeviceFiltersSchema.parse({
				formats: ["gif"],
			}),
		).toThrow()
	})

	test("rejects non-positive min_width", () => {
		expect(() =>
			DeviceFiltersSchema.parse({
				min_width: 0,
			}),
		).toThrow()
	})

	test("accepts nsfw_only as nsfw value", () => {
		const result = DeviceFiltersSchema.parse({ nsfw: "nsfw_only" })
		expect(result.nsfw).toBe("nsfw_only")
	})
})
