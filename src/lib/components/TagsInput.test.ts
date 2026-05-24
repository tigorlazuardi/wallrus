/**
 * TagsInput component tests.
 *
 * TagsInput manages a string[] of tags:
 *   - Enter key on the text input adds the current text as a new tag
 *     (trimmed, lowercased, deduplicated).
 *   - Backspace on empty input removes the last tag.
 *   - Clicking the chip X button removes that specific tag.
 *
 * Tests replicate the component's pure logic without mounting the component
 * (bun:test does not support Svelte DOM rendering without additional tooling).
 */
import { describe, expect, test } from "bun:test"

// ---------------------------------------------------------------------------
// Replicated TagsInput logic (mirrors the component's functions)
// ---------------------------------------------------------------------------

function add_tag(current: string[], raw: string): string[] {
	const tag = raw.trim().toLowerCase()
	if (tag && !current.includes(tag)) {
		return [...current, tag]
	}
	return current
}

function remove_tag(current: string[], tag: string): string[] {
	return current.filter((t) => t !== tag)
}

function remove_last(current: string[]): string[] {
	return current.slice(0, -1)
}

function handle_keydown(
	key: string,
	input_text: string,
	tags: string[],
): { tags: string[]; input_text: string } {
	if (key === "Enter") {
		return { tags: add_tag(tags, input_text), input_text: "" }
	}
	if (key === "Backspace" && input_text === "" && tags.length > 0) {
		return { tags: remove_last(tags), input_text: "" }
	}
	return { tags, input_text }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TagsInput — add tag", () => {
	test("Enter adds the trimmed + lowercased input as a new tag", () => {
		const result = handle_keydown("Enter", "  MyTag  ", [])
		expect(result.tags).toEqual(["mytag"])
		expect(result.input_text).toBe("")
	})

	test("Enter with empty string does not add a tag", () => {
		const result = handle_keydown("Enter", "   ", [])
		expect(result.tags).toEqual([])
	})

	test("Enter does not add a duplicate tag", () => {
		const result = handle_keydown("Enter", "landscape", ["landscape", "mountain"])
		expect(result.tags).toEqual(["landscape", "mountain"])
	})

	test("Enter clears the input after adding", () => {
		const result = handle_keydown("Enter", "ocean", [])
		expect(result.input_text).toBe("")
	})
})

describe("TagsInput — remove tag", () => {
	test("Backspace on empty input removes the last tag", () => {
		const result = handle_keydown("Backspace", "", ["landscape", "ocean"])
		expect(result.tags).toEqual(["landscape"])
	})

	test("Backspace on non-empty input does NOT remove a tag", () => {
		const result = handle_keydown("Backspace", "ocean", ["landscape"])
		expect(result.tags).toEqual(["landscape"])
	})

	test("Backspace on empty input with no tags does nothing", () => {
		const result = handle_keydown("Backspace", "", [])
		expect(result.tags).toEqual([])
	})

	test("click X removes the specific tag", () => {
		const tags = remove_tag(["landscape", "ocean", "mountain"], "ocean")
		expect(tags).toEqual(["landscape", "mountain"])
	})
})

describe("TagsInput — deduplication", () => {
	test("case-insensitive dedup: 'Ocean' is not added when 'ocean' already exists", () => {
		const result = add_tag(["ocean"], "Ocean")
		expect(result).toEqual(["ocean"])
	})

	test("trimmed input is checked for dedup", () => {
		const result = add_tag(["ocean"], "  ocean  ")
		expect(result).toEqual(["ocean"])
	})
})
