import { afterEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { sources, get_source, list_sources, register, register_sources } from "./_registry"
import type { SourceModule } from "./_types"

function make_mock_source(slug: string): SourceModule {
	return {
		slug,
		display_name: `Mock: ${slug}`,
		params_schema: z.object({}).passthrough(),
		async *fetch() {},
	}
}

afterEach(() => {
	// Clean up any sources registered during tests
	for (const key of Object.keys(sources)) {
		delete sources[key]
	}
})

describe("sources registry", () => {
	test("register + get_source roundtrip", () => {
		const src = make_mock_source("test-source")
		register(src)
		const result = get_source("test-source")
		expect(result).toBeDefined()
		expect(result?.slug).toBe("test-source")
		expect(result?.display_name).toBe("Mock: test-source")
	})

	test("get_source returns undefined for missing slug", () => {
		const result = get_source("does-not-exist")
		expect(result).toBeUndefined()
	})

	test("list_sources returns all registered sources", () => {
		const a = make_mock_source("source-a")
		const b = make_mock_source("source-b")
		register(a)
		register(b)
		const list = list_sources()
		expect(list.length).toBe(2)
		const slugs = list.map((s) => s.slug).sort()
		expect(slugs).toEqual(["source-a", "source-b"])
	})

	test("list_sources returns empty array when nothing registered", () => {
		expect(list_sources()).toEqual([])
	})

	test("register overwrites existing entry with same slug", () => {
		const v1 = make_mock_source("dupe")
		const v2 = { ...make_mock_source("dupe"), display_name: "Updated" }
		register(v1)
		register(v2)
		expect(get_source("dupe")?.display_name).toBe("Updated")
	})

	test("register_sources does not throw and registers built-in sources", () => {
		expect(() => register_sources()).not.toThrow()
		// register_sources now registers the reddit source (slice 007)
		// and the booru source (slice 008).
		const slugs = list_sources().map((s) => s.slug)
		expect(slugs).toContain("reddit")
		expect(slugs).toContain("booru")
	})
})
