import { test, expect, describe } from "bun:test"
import { slugify } from "./slugify"

describe("slugify", () => {
	test("empty string returns empty string", () => {
		expect(slugify("")).toBe("")
	})

	test("ASCII passthrough - simple kebab", () => {
		expect(slugify("pixel-9-pro")).toBe("pixel-9-pro")
	})

	test("mixed case lowercased", () => {
		expect(slugify("Pixel 9 Pro")).toBe("pixel-9-pro")
	})

	test("spaces converted to hyphens", () => {
		expect(slugify("hello world")).toBe("hello-world")
	})

	test("double spaces collapsed to single hyphen", () => {
		expect(slugify("Test  Foo")).toBe("test-foo")
	})

	test("leading and trailing whitespace trimmed", () => {
		expect(slugify("  pixel  ")).toBe("pixel")
	})

	test("diacritics stripped (pixel café)", () => {
		expect(slugify("pixel café")).toBe("pixel-cafe")
	})

	test("more diacritics (Ångström)", () => {
		expect(slugify("Ångström")).toBe("angstrom")
	})

	test("emoji stripped (rocket)", () => {
		expect(slugify("🚀 rocket")).toBe("rocket")
	})

	test("emoji-only returns empty string", () => {
		expect(slugify("🎉")).toBe("")
	})

	test("max-length truncation at 64 chars", () => {
		const input = "a".repeat(100)
		const result = slugify(input)
		expect(result).toBe("a".repeat(64))
		expect(result.length).toBe(64)
	})

	test("already-valid slug passes through unchanged", () => {
		expect(slugify("my-device-slug")).toBe("my-device-slug")
	})

	test("punctuation and special chars become hyphens then collapse", () => {
		expect(slugify("hello--world!")).toBe("hello-world")
	})

	test("numbers preserved", () => {
		expect(slugify("Galaxy S24 Ultra 5G")).toBe("galaxy-s24-ultra-5g")
	})
})
