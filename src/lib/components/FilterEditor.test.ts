/**
 * FilterEditor component tests.
 *
 * FilterEditor maintains a DeviceFilters value bound from outside.
 * Tests replicate the pure data-transformation logic: string inputs → typed
 * DeviceFilters fields, MB ↔ bytes conversion, format toggle, tag management.
 *
 * The component's $effect syncs local string state → the bound value object.
 * We test that transformation in isolation without mounting the component.
 */
import { describe, expect, test } from "bun:test"
import type { DeviceFilters } from "$lib/schemas/devices/DeviceFilters"
import { DeviceFiltersSchema } from "$lib/schemas/devices/DeviceFilters"

// ---------------------------------------------------------------------------
// Replicated FilterEditor computation logic
// ---------------------------------------------------------------------------

function build_filter_value(opts: {
	min_width_str: string
	max_width_str: string
	min_height_str: string
	max_height_str: string
	aspect_target_str: string
	aspect_tolerance: number
	min_mb_str: string
	max_mb_str: string
	selected_formats: string[]
	tags_include: string[]
	tags_exclude: string[]
	nsfw: DeviceFilters["nsfw"]
}): DeviceFilters {
	const min_w = opts.min_width_str !== "" ? parseInt(opts.min_width_str, 10) : undefined
	const max_w = opts.max_width_str !== "" ? parseInt(opts.max_width_str, 10) : undefined
	const min_h = opts.min_height_str !== "" ? parseInt(opts.min_height_str, 10) : undefined
	const max_h = opts.max_height_str !== "" ? parseInt(opts.max_height_str, 10) : undefined

	const aspect_target =
		opts.aspect_target_str !== "" ? parseFloat(opts.aspect_target_str) : undefined
	const aspect =
		aspect_target !== undefined
			? { target: aspect_target, tolerance: opts.aspect_tolerance }
			: undefined

	const min_bytes = opts.min_mb_str !== "" ? parseFloat(opts.min_mb_str) * 1_000_000 : undefined
	const max_bytes = opts.max_mb_str !== "" ? parseFloat(opts.max_mb_str) * 1_000_000 : undefined

	return {
		...(min_w !== undefined && !isNaN(min_w) ? { min_width: min_w } : {}),
		...(max_w !== undefined && !isNaN(max_w) ? { max_width: max_w } : {}),
		...(min_h !== undefined && !isNaN(min_h) ? { min_height: min_h } : {}),
		...(max_h !== undefined && !isNaN(max_h) ? { max_height: max_h } : {}),
		...(aspect !== undefined ? { aspect_ratio: aspect } : {}),
		...(min_bytes !== undefined && !isNaN(min_bytes)
			? { min_bytes: Math.round(min_bytes) }
			: {}),
		...(max_bytes !== undefined && !isNaN(max_bytes)
			? { max_bytes: Math.round(max_bytes) }
			: {}),
		...(opts.selected_formats.length > 0
			? { formats: opts.selected_formats as DeviceFilters["formats"] }
			: {}),
		...(opts.tags_include.length > 0 ? { tags_include: opts.tags_include } : {}),
		...(opts.tags_exclude.length > 0 ? { tags_exclude: opts.tags_exclude } : {}),
		nsfw: opts.nsfw,
	}
}

const empty_opts = {
	min_width_str: "",
	max_width_str: "",
	min_height_str: "",
	max_height_str: "",
	aspect_target_str: "",
	aspect_tolerance: 0.15,
	min_mb_str: "",
	max_mb_str: "",
	selected_formats: [] as string[],
	tags_include: [] as string[],
	tags_exclude: [] as string[],
	nsfw: "all" as const,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FilterEditor — resolution inputs", () => {
	test("numeric string sets min_width", () => {
		const v = build_filter_value({ ...empty_opts, min_width_str: "1920" })
		expect(v.min_width).toBe(1920)
	})

	test("empty string leaves min_width undefined", () => {
		const v = build_filter_value({ ...empty_opts, min_width_str: "" })
		expect(v.min_width).toBeUndefined()
	})

	test("all four resolution fields set simultaneously", () => {
		const v = build_filter_value({
			...empty_opts,
			min_width_str: "1920",
			max_width_str: "7680",
			min_height_str: "1080",
			max_height_str: "4320",
		})
		expect(v.min_width).toBe(1920)
		expect(v.max_width).toBe(7680)
		expect(v.min_height).toBe(1080)
		expect(v.max_height).toBe(4320)
	})
})

describe("FilterEditor — file size MB ↔ bytes conversion", () => {
	test("1 MB converts to 1_000_000 bytes", () => {
		const v = build_filter_value({ ...empty_opts, min_mb_str: "1" })
		expect(v.min_bytes).toBe(1_000_000)
	})

	test("0.5 MB converts to 500_000 bytes", () => {
		const v = build_filter_value({ ...empty_opts, min_mb_str: "0.5" })
		expect(v.min_bytes).toBe(500_000)
	})

	test("10 MB converts to 10_000_000 bytes", () => {
		const v = build_filter_value({ ...empty_opts, max_mb_str: "10" })
		expect(v.max_bytes).toBe(10_000_000)
	})

	test("empty string leaves min_bytes undefined", () => {
		const v = build_filter_value({ ...empty_opts, min_mb_str: "" })
		expect(v.min_bytes).toBeUndefined()
	})
})

describe("FilterEditor — aspect ratio", () => {
	test("setting target creates aspect_ratio object", () => {
		const v = build_filter_value({
			...empty_opts,
			aspect_target_str: "1.78",
			aspect_tolerance: 0.1,
		})
		expect(v.aspect_ratio).toEqual({ target: 1.78, tolerance: 0.1 })
	})

	test("empty target leaves aspect_ratio undefined", () => {
		const v = build_filter_value({ ...empty_opts, aspect_target_str: "" })
		expect(v.aspect_ratio).toBeUndefined()
	})
})

describe("FilterEditor — formats", () => {
	test("selected formats appear in value.formats", () => {
		const v = build_filter_value({ ...empty_opts, selected_formats: ["jpg", "png"] })
		expect(v.formats).toEqual(["jpg", "png"])
	})

	test("empty formats leaves formats undefined", () => {
		const v = build_filter_value({ ...empty_opts, selected_formats: [] })
		expect(v.formats).toBeUndefined()
	})
})

describe("FilterEditor — tags", () => {
	test("tags_include and tags_exclude are passed through", () => {
		const v = build_filter_value({
			...empty_opts,
			tags_include: ["landscape"],
			tags_exclude: ["gore"],
		})
		expect(v.tags_include).toEqual(["landscape"])
		expect(v.tags_exclude).toEqual(["gore"])
	})
})

describe("FilterEditor — NSFW radio", () => {
	test("nsfw defaults to 'all'", () => {
		const v = build_filter_value(empty_opts)
		expect(v.nsfw).toBe("all")
	})

	test("nsfw 'sfw_only' is preserved", () => {
		const v = build_filter_value({ ...empty_opts, nsfw: "sfw_only" })
		expect(v.nsfw).toBe("sfw_only")
	})
})

describe("FilterEditor — DeviceFiltersSchema validation", () => {
	test("produced value passes DeviceFiltersSchema", () => {
		const v = build_filter_value({
			...empty_opts,
			min_width_str: "1920",
			min_mb_str: "0.5",
			selected_formats: ["jpg", "webp"],
			nsfw: "sfw_only",
		})
		const result = DeviceFiltersSchema.safeParse(v)
		expect(result.success).toBe(true)
	})
})
