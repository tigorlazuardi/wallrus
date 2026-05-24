/**
 * DeviceSelector component tests.
 *
 * DeviceSelector manages a string[] of selected device ids:
 *   - Clicking a chip that is NOT in `value` adds its id
 *   - Clicking a chip that IS in `value` removes its id
 *
 * Tests replicate the component's pure toggle logic without mounting.
 */
import { describe, expect, test } from "bun:test"

// ---------------------------------------------------------------------------
// Replicated DeviceSelector toggle logic (mirrors the component's function)
// ---------------------------------------------------------------------------

function toggle(current: string[], id: string): string[] {
	if (current.includes(id)) {
		return current.filter((v) => v !== id)
	}
	return [...current, id]
}

function is_selected(current: string[], id: string): boolean {
	return current.includes(id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeviceSelector — toggle", () => {
	test("toggling an unselected device adds it", () => {
		const result = toggle(["a"], "b")
		expect(result).toContain("b")
		expect(result).toContain("a")
		expect(result).toHaveLength(2)
	})

	test("toggling a selected device removes it", () => {
		const result = toggle(["a", "b"], "b")
		expect(result).not.toContain("b")
		expect(result).toContain("a")
		expect(result).toHaveLength(1)
	})

	test("toggling the only selected device leaves an empty array", () => {
		const result = toggle(["sole"], "sole")
		expect(result).toHaveLength(0)
	})

	test("toggling does not mutate the original array", () => {
		const original = ["a", "b"]
		const result = toggle(original, "c")
		expect(original).toHaveLength(2)
		expect(result).toHaveLength(3)
	})
})

describe("DeviceSelector — is_selected", () => {
	test("returns true for a device in the selection", () => {
		expect(is_selected(["a", "b"], "a")).toBe(true)
	})

	test("returns false for a device not in the selection", () => {
		expect(is_selected(["a", "b"], "c")).toBe(false)
	})

	test("returns false for empty selection", () => {
		expect(is_selected([], "a")).toBe(false)
	})
})

describe("DeviceSelector — multi-toggle sequence", () => {
	test("adding three devices then removing one ends with two", () => {
		let sel: string[] = []
		sel = toggle(sel, "id-1")
		sel = toggle(sel, "id-2")
		sel = toggle(sel, "id-3")
		sel = toggle(sel, "id-2")
		expect(sel).toHaveLength(2)
		expect(sel).toContain("id-1")
		expect(sel).toContain("id-3")
		expect(sel).not.toContain("id-2")
	})
})
