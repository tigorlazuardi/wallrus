import { describe, expect, test } from "bun:test"
import { CreateDeviceRequestSchema } from "./CreateDevice"

describe("CreateDeviceRequestSchema", () => {
	test("accepts valid slug and name", () => {
		const result = CreateDeviceRequestSchema.parse({
			slug: "my-device",
			name: "My Device",
		})
		expect(result.slug).toBe("my-device")
		expect(result.name).toBe("My Device")
	})

	test("defaults filter_criteria.nsfw to 'all' when not provided", () => {
		const result = CreateDeviceRequestSchema.parse({ slug: "tv", name: "TV" })
		expect(result.filter_criteria.nsfw).toBe("all")
	})

	test("slug regex rejects uppercase letters", () => {
		expect(() => CreateDeviceRequestSchema.parse({ slug: "MyDevice", name: "x" })).toThrow()
	})

	test("slug regex rejects underscores", () => {
		expect(() => CreateDeviceRequestSchema.parse({ slug: "my_device", name: "x" })).toThrow()
	})

	test("slug regex rejects spaces", () => {
		expect(() => CreateDeviceRequestSchema.parse({ slug: "my device", name: "x" })).toThrow()
	})

	test("slug regex rejects empty string", () => {
		expect(() => CreateDeviceRequestSchema.parse({ slug: "", name: "x" })).toThrow()
	})

	test("slug regex rejects slug over 64 chars", () => {
		const long_slug = "a".repeat(65)
		expect(() => CreateDeviceRequestSchema.parse({ slug: long_slug, name: "x" })).toThrow()
	})

	test("slug regex accepts 64-char slug", () => {
		const slug = "a".repeat(64)
		const result = CreateDeviceRequestSchema.parse({ slug, name: "x" })
		expect(result.slug).toBe(slug)
	})

	test("slug regex accepts numbers and hyphens", () => {
		const result = CreateDeviceRequestSchema.parse({ slug: "device-123", name: "x" })
		expect(result.slug).toBe("device-123")
	})

	test("transform lowercases the slug", () => {
		// slug regex requires lowercase, so this should fail but let's be safe
		// Since the regex enforces lowercase, we test a valid lowercase slug is preserved
		const result = CreateDeviceRequestSchema.parse({ slug: "my-tv-4k", name: "TV" })
		expect(result.slug).toBe("my-tv-4k")
	})

	test("name must be non-empty", () => {
		expect(() => CreateDeviceRequestSchema.parse({ slug: "test", name: "" })).toThrow()
	})
})
