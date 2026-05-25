import { describe, expect, test } from "bun:test"
import { evaluate, type ImageMeta } from "./filters"
import type { DeviceFilterCriteria } from "$lib/server/db/schema"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const base_image: ImageMeta = {
	width: 1920,
	height: 1080,
	file_size: 1_000_000,
	format: "jpg",
	tags: ["nature", "landscape"],
	nsfw: "sfw",
}

const permissive_criteria: DeviceFilterCriteria = {
	nsfw: "all",
}

// ---------------------------------------------------------------------------
// Empty / permissive criteria → always pass
// ---------------------------------------------------------------------------

describe("empty / permissive criteria", () => {
	test("passes with only nsfw: all", () => {
		expect(evaluate(base_image, permissive_criteria)).toEqual({ pass: true })
	})

	test("passes with fully empty optional fields", () => {
		const criteria: DeviceFilterCriteria = {
			nsfw: "all",
			formats: [],
			tags_include: [],
			tags_exclude: [],
		}
		expect(evaluate(base_image, criteria)).toEqual({ pass: true })
	})
})

// ---------------------------------------------------------------------------
// NSFW
// ---------------------------------------------------------------------------

describe("nsfw filter", () => {
	test("sfw_only rejects nsfw image", () => {
		const result = evaluate({ ...base_image, nsfw: "nsfw" }, { nsfw: "sfw_only" })
		expect(result).toEqual({ pass: false, reason: "nsfw" })
	})

	test("sfw_only rejects unknown image", () => {
		const result = evaluate({ ...base_image, nsfw: "unknown" }, { nsfw: "sfw_only" })
		expect(result).toEqual({ pass: false, reason: "nsfw" })
	})

	test("sfw_only passes sfw image", () => {
		const result = evaluate({ ...base_image, nsfw: "sfw" }, { nsfw: "sfw_only" })
		expect(result).toEqual({ pass: true })
	})

	test("nsfw_only rejects sfw image", () => {
		const result = evaluate({ ...base_image, nsfw: "sfw" }, { nsfw: "nsfw_only" })
		expect(result).toEqual({ pass: false, reason: "nsfw" })
	})

	test("nsfw_only rejects unknown image", () => {
		const result = evaluate({ ...base_image, nsfw: "unknown" }, { nsfw: "nsfw_only" })
		expect(result).toEqual({ pass: false, reason: "nsfw" })
	})

	test("nsfw_only passes nsfw image", () => {
		const result = evaluate({ ...base_image, nsfw: "nsfw" }, { nsfw: "nsfw_only" })
		expect(result).toEqual({ pass: true })
	})

	test("all allows sfw", () => {
		expect(evaluate({ ...base_image, nsfw: "sfw" }, { nsfw: "all" })).toEqual({ pass: true })
	})

	test("all allows nsfw", () => {
		expect(evaluate({ ...base_image, nsfw: "nsfw" }, { nsfw: "all" })).toEqual({ pass: true })
	})

	test("all allows unknown", () => {
		expect(evaluate({ ...base_image, nsfw: "unknown" }, { nsfw: "all" })).toEqual({
			pass: true,
		})
	})
})

// ---------------------------------------------------------------------------
// Format allowlist
// ---------------------------------------------------------------------------

describe("format filter", () => {
	test("rejects image not in allowlist", () => {
		const result = evaluate(
			{ ...base_image, format: "png" },
			{ nsfw: "all", formats: ["jpg", "webp"] },
		)
		expect(result).toEqual({ pass: false, reason: "format" })
	})

	test("passes image in allowlist", () => {
		const result = evaluate(
			{ ...base_image, format: "webp" },
			{ nsfw: "all", formats: ["jpg", "webp"] },
		)
		expect(result).toEqual({ pass: true })
	})

	test("empty formats list passes anything", () => {
		const result = evaluate(base_image, { nsfw: "all", formats: [] })
		expect(result).toEqual({ pass: true })
	})
})

// ---------------------------------------------------------------------------
// Resolution (min/max width/height)
// ---------------------------------------------------------------------------

describe("resolution filter", () => {
	test("rejects image below min_width", () => {
		const result = evaluate({ ...base_image, width: 1279 }, { nsfw: "all", min_width: 1280 })
		expect(result).toEqual({ pass: false, reason: "min_width" })
	})

	test("passes image at exact min_width", () => {
		const result = evaluate({ ...base_image, width: 1280 }, { nsfw: "all", min_width: 1280 })
		expect(result).toEqual({ pass: true })
	})

	test("rejects image below min_height", () => {
		const result = evaluate({ ...base_image, height: 719 }, { nsfw: "all", min_height: 720 })
		expect(result).toEqual({ pass: false, reason: "min_height" })
	})

	test("rejects image above max_width", () => {
		const result = evaluate({ ...base_image, width: 3841 }, { nsfw: "all", max_width: 3840 })
		expect(result).toEqual({ pass: false, reason: "max_width" })
	})

	test("rejects image above max_height", () => {
		const result = evaluate({ ...base_image, height: 2161 }, { nsfw: "all", max_height: 2160 })
		expect(result).toEqual({ pass: false, reason: "max_height" })
	})

	test("passes image within res bounds", () => {
		const result = evaluate(base_image, {
			nsfw: "all",
			min_width: 1280,
			min_height: 720,
			max_width: 3840,
			max_height: 2160,
		})
		expect(result).toEqual({ pass: true })
	})
})

// ---------------------------------------------------------------------------
// Aspect ratio
// ---------------------------------------------------------------------------

describe("aspect ratio filter", () => {
	test("passes when ratio is within tolerance", () => {
		// 16:9 = ~1.7778, target 1.78 tol 0.01 (1%)
		// actual/target - 1 = 1.7778/1.78 - 1 ≈ -0.00124, abs < 0.01 → pass
		const result = evaluate(base_image, {
			nsfw: "all",
			aspect_ratio: { target: 16 / 9, tolerance: 0.01 },
		})
		expect(result).toEqual({ pass: true })
	})

	test("rejects when ratio exceeds tolerance", () => {
		// 4:3 = 1.333; target 16/9 ≈ 1.778; percent deviation ≈ 25% > 10%
		const result = evaluate(
			{ ...base_image, width: 1280, height: 960 },
			{ nsfw: "all", aspect_ratio: { target: 16 / 9, tolerance: 0.1 } },
		)
		expect(result).toEqual({ pass: false, reason: "aspect_ratio" })
	})

	test("passes when ratio exactly matches target", () => {
		const result = evaluate(
			{ ...base_image, width: 16, height: 9 },
			{ nsfw: "all", aspect_ratio: { target: 16 / 9, tolerance: 0 } },
		)
		expect(result).toEqual({ pass: true })
	})

	test("passes: target 1.78, tolerance 0.1, actual 1.85 (within 10%)", () => {
		// actual/target - 1 = 1.85/1.78 - 1 ≈ 0.0393, abs < 0.1 → pass
		const result = evaluate(
			{ ...base_image, width: 185, height: 100 },
			{ nsfw: "all", aspect_ratio: { target: 1.78, tolerance: 0.1 } },
		)
		expect(result).toEqual({ pass: true })
	})

	test("fails: target 1.78, tolerance 0.1, actual 1.5 (outside 10%)", () => {
		// actual/target - 1 = 1.5/1.78 - 1 ≈ -0.157, abs > 0.1 → fail
		const result = evaluate(
			{ ...base_image, width: 150, height: 100 },
			{ nsfw: "all", aspect_ratio: { target: 1.78, tolerance: 0.1 } },
		)
		expect(result).toEqual({ pass: false, reason: "aspect_ratio" })
	})

	test("passes: target 0.5, tolerance 0.1, actual ~0.54 (within 10%)", () => {
		// actual/target - 1 = 0.54/0.5 - 1 ≈ 0.08, abs < 0.1 → pass
		const result = evaluate(
			{ ...base_image, width: 54, height: 100 },
			{ nsfw: "all", aspect_ratio: { target: 0.5, tolerance: 0.1 } },
		)
		expect(result).toEqual({ pass: true })
	})

	test("edge case: target 0, tolerance 0.1 → pass (no opinion when target invalid)", () => {
		const result = evaluate(base_image, {
			nsfw: "all",
			aspect_ratio: { target: 0, tolerance: 0.1 },
		})
		expect(result).toEqual({ pass: true })
	})
})

// ---------------------------------------------------------------------------
// File size
// ---------------------------------------------------------------------------

describe("file size filter", () => {
	test("rejects image below min_bytes", () => {
		const result = evaluate(
			{ ...base_image, file_size: 99_999 },
			{ nsfw: "all", min_bytes: 100_000 },
		)
		expect(result).toEqual({ pass: false, reason: "min_bytes" })
	})

	test("passes image at exact min_bytes", () => {
		const result = evaluate(
			{ ...base_image, file_size: 100_000 },
			{ nsfw: "all", min_bytes: 100_000 },
		)
		expect(result).toEqual({ pass: true })
	})

	test("rejects image above max_bytes", () => {
		const result = evaluate(
			{ ...base_image, file_size: 10_000_001 },
			{ nsfw: "all", max_bytes: 10_000_000 },
		)
		expect(result).toEqual({ pass: false, reason: "max_bytes" })
	})

	test("passes image within size bounds", () => {
		const result = evaluate(base_image, {
			nsfw: "all",
			min_bytes: 500_000,
			max_bytes: 5_000_000,
		})
		expect(result).toEqual({ pass: true })
	})
})

// ---------------------------------------------------------------------------
// Tags include / exclude
// ---------------------------------------------------------------------------

describe("tags_include filter", () => {
	test("passes when image has all required tags", () => {
		const result = evaluate(
			{ ...base_image, tags: ["nature", "landscape", "mountain"] },
			{ nsfw: "all", tags_include: ["nature", "landscape"] },
		)
		expect(result).toEqual({ pass: true })
	})

	test("rejects when image is missing a required tag", () => {
		const result = evaluate(
			{ ...base_image, tags: ["nature"] },
			{ nsfw: "all", tags_include: ["nature", "ocean"] },
		)
		expect(result).toEqual({ pass: false, reason: "tags_include" })
	})

	test("tag matching is case-insensitive", () => {
		const result = evaluate(
			{ ...base_image, tags: ["Nature", "LANDSCAPE"] },
			{ nsfw: "all", tags_include: ["nature", "landscape"] },
		)
		expect(result).toEqual({ pass: true })
	})

	test("empty tags_include always passes", () => {
		const result = evaluate({ ...base_image, tags: [] }, { nsfw: "all", tags_include: [] })
		expect(result).toEqual({ pass: true })
	})
})

describe("tags_exclude filter", () => {
	test("rejects when image has an excluded tag", () => {
		const result = evaluate(
			{ ...base_image, tags: ["nature", "gore"] },
			{ nsfw: "all", tags_exclude: ["gore"] },
		)
		expect(result).toEqual({ pass: false, reason: "tags_exclude" })
	})

	test("passes when image has no excluded tags", () => {
		const result = evaluate(
			{ ...base_image, tags: ["nature", "landscape"] },
			{ nsfw: "all", tags_exclude: ["gore", "violence"] },
		)
		expect(result).toEqual({ pass: true })
	})

	test("exclude tag matching is case-insensitive", () => {
		const result = evaluate(
			{ ...base_image, tags: ["Gore", "Nature"] },
			{ nsfw: "all", tags_exclude: ["gore"] },
		)
		expect(result).toEqual({ pass: false, reason: "tags_exclude" })
	})
})

describe("tags include + exclude conflict — exclude wins", () => {
	test("exclude beats include on the same tag", () => {
		// Image has 'nature' which is both required (include) and banned (exclude)
		// Exclude should win and return false
		const result = evaluate(
			{ ...base_image, tags: ["nature", "landscape"] },
			{
				nsfw: "all",
				tags_include: ["nature"],
				tags_exclude: ["nature"],
			},
		)
		expect(result).toEqual({ pass: false, reason: "tags_exclude" })
	})

	test("exclude wins even when include would otherwise pass", () => {
		const result = evaluate(
			{ ...base_image, tags: ["nature", "mountain", "badtag"] },
			{
				nsfw: "all",
				tags_include: ["nature", "mountain"],
				tags_exclude: ["badtag"],
			},
		)
		expect(result).toEqual({ pass: false, reason: "tags_exclude" })
	})
})
