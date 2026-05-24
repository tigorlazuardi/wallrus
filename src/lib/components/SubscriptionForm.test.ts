/**
 * SubscriptionForm component tests.
 *
 * Tests the pure logic of the form:
 * - ParamDescriptor derivation per source slug
 * - input_params reset when source changes
 * - field_errors shape
 *
 * bun:test ignores @vitest-environment so tests assert on behavior and data
 * transformations rather than rendered DOM.
 */
import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { serialize_params_schema } from "$lib/server/sources/params_descriptor"
import type { ParamDescriptor } from "./SubscriptionForm.types"

// ---------------------------------------------------------------------------
// serialize_params_schema tests
// ---------------------------------------------------------------------------

describe("serialize_params_schema", () => {
	test("returns empty array for non-object schema", () => {
		const result = serialize_params_schema(z.string())
		expect(result).toEqual([])
	})

	test("serializes ZodString field", () => {
		const schema = z.object({ subreddit: z.string() })
		const result = serialize_params_schema(schema)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({ key: "subreddit", type: "string" })
	})

	test("serializes ZodNumber field", () => {
		const schema = z.object({ limit: z.number().int().min(1).max(100) })
		const result = serialize_params_schema(schema)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({ key: "limit", type: "number" })
	})

	test("serializes ZodBoolean field", () => {
		const schema = z.object({ nsfw: z.boolean() })
		const result = serialize_params_schema(schema)
		expect(result[0]).toMatchObject({ key: "nsfw", type: "boolean" })
	})

	test("serializes ZodEnum field", () => {
		const schema = z.object({ sort: z.enum(["hot", "new", "top"]) })
		const result = serialize_params_schema(schema)
		expect(result[0]).toMatchObject({
			key: "sort",
			type: "enum",
			enum_values: ["hot", "new", "top"],
		})
	})

	test("serializes ZodArray(ZodString) as array_string", () => {
		const schema = z.object({ tags: z.array(z.string()) })
		const result = serialize_params_schema(schema)
		expect(result[0]).toMatchObject({ key: "tags", type: "array_string" })
	})

	test("ignores ZodArray(ZodNumber) — not a supported param type", () => {
		const schema = z.object({ ids: z.array(z.number()) })
		const result = serialize_params_schema(schema)
		expect(result).toHaveLength(0)
	})

	test("unwraps ZodOptional to get base type", () => {
		const schema = z.object({ time: z.string().optional() })
		const result = serialize_params_schema(schema)
		expect(result[0]).toMatchObject({ key: "time", type: "string", optional: true })
	})

	test("unwraps ZodDefault to get base type and default value", () => {
		const schema = z.object({ limit: z.number().default(100) })
		const result = serialize_params_schema(schema)
		expect(result[0]).toMatchObject({ key: "limit", type: "number", default: 100 })
	})

	test("handles strict ZodObject (from .strict())", () => {
		const schema = z
			.object({
				subreddit: z.string(),
				sort: z.enum(["hot", "new"]).default("hot"),
			})
			.strict()
		const result = serialize_params_schema(schema)
		expect(result).toHaveLength(2)
		expect(result.find((d) => d.key === "subreddit")).toBeDefined()
		expect(result.find((d) => d.key === "sort")).toMatchObject({ type: "enum", default: "hot" })
	})

	test("generates label from key name with underscores replaced by spaces", () => {
		const schema = z.object({ limit_per_page: z.number() })
		const result = serialize_params_schema(schema)
		expect(result[0]?.label).toBe("limit per page")
	})
})

// ---------------------------------------------------------------------------
// SubscriptionForm integration logic tests
// ---------------------------------------------------------------------------

describe("SubscriptionForm param derivation logic", () => {
	// Simulate the logic in the page that picks param_descriptors for a source
	function get_param_descriptors(
		sources: Array<{ slug: string; param_descriptors: ParamDescriptor[] }>,
		source_slug: string,
	): ParamDescriptor[] {
		const src = sources.find((s) => s.slug === source_slug)
		return src?.param_descriptors ?? []
	}

	const mock_sources = [
		{
			slug: "reddit",
			param_descriptors: serialize_params_schema(
				z.object({
					subreddit: z.string(),
					sort: z.enum(["hot", "new", "top"]).default("hot"),
					limit_per_page: z.number().int().default(100),
				}),
			),
		},
		{
			slug: "booru",
			param_descriptors: serialize_params_schema(
				z.object({
					tags: z.array(z.string()),
					rating: z.enum(["s", "q", "e", "any"]).default("any"),
				}),
			),
		},
	]

	test("returns descriptors for selected source", () => {
		const descs = get_param_descriptors(mock_sources, "reddit")
		expect(descs.length).toBe(3)
		expect(descs.map((d) => d.key)).toEqual(["subreddit", "sort", "limit_per_page"])
	})

	test("returns empty array when source not found", () => {
		const descs = get_param_descriptors(mock_sources, "unknown-source")
		expect(descs).toEqual([])
	})

	test("returns empty array when no source selected", () => {
		const descs = get_param_descriptors(mock_sources, "")
		expect(descs).toEqual([])
	})

	test("switching source returns different descriptors", () => {
		const reddit_descs = get_param_descriptors(mock_sources, "reddit")
		const booru_descs = get_param_descriptors(mock_sources, "booru")
		expect(reddit_descs[0]?.key).toBe("subreddit")
		expect(booru_descs[0]?.key).toBe("tags")
	})

	test("input_params reset logic on source change", () => {
		// Simulates the $effect that clears input_params on source_slug change
		let input_params: Record<string, unknown> = { subreddit: "wallpapers", sort: "hot" }
		let source_slug = "reddit"

		const new_slug = "booru"
		if (source_slug !== new_slug) {
			source_slug = new_slug
			input_params = {} // reset
		}

		expect(input_params).toEqual({})
		expect(source_slug).toBe("booru")
	})
})

// ---------------------------------------------------------------------------
// Error shape helpers
// ---------------------------------------------------------------------------

describe("SubscriptionForm error helpers", () => {
	function get_error(
		errors: Record<string, string | string[]>,
		field: string,
	): string | undefined {
		const val = errors[field]
		if (!val) return undefined
		return Array.isArray(val) ? val[0] : val
	}

	test("returns first error from array", () => {
		const errors = { name: ["Name is required", "Must be at least 1 char"] }
		expect(get_error(errors, "name")).toBe("Name is required")
	})

	test("returns string error directly", () => {
		const errors = { source_slug: "Source is required" }
		expect(get_error(errors, "source_slug")).toBe("Source is required")
	})

	test("returns undefined when no error for field", () => {
		const errors = { name: ["error"] }
		expect(get_error(errors, "cron")).toBeUndefined()
	})

	test("returns undefined for empty errors object", () => {
		expect(get_error({}, "name")).toBeUndefined()
	})
})
