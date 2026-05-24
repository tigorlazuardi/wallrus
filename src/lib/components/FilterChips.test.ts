/**
 * FilterChips component tests.
 *
 * Tests verify the URL state logic:
 *   - toggle_device: sets ?device=slug or removes it on second toggle
 *   - toggle_source: sets ?source=name or removes it
 *   - toggle_favorited: sets ?favorited=true or removes it
 *   - toggle_nsfw: sets ?nsfw=value or removes it
 *   - pagination params (next/prev) are cleared on any filter change
 */

import { describe, test, expect } from "bun:test"

// ---------------------------------------------------------------------------
// Replicate the URL manipulation logic from FilterChips.svelte
// ---------------------------------------------------------------------------

interface FilterState {
	device: string
	source: string
	favorited: boolean
	nsfw: string
}

function parse_filter(url: URL): FilterState {
	return {
		device: url.searchParams.get("device") ?? "",
		source: url.searchParams.get("source") ?? "",
		favorited: url.searchParams.get("favorited") === "true",
		nsfw: url.searchParams.get("nsfw") ?? "",
	}
}

function update_param(url: URL, key: string, value: string | null): URL {
	const next = new URL(url.toString())
	if (value === null || value === "") {
		next.searchParams.delete(key)
	} else {
		next.searchParams.set(key, value)
	}
	next.searchParams.delete("next")
	next.searchParams.delete("prev")
	return next
}

function toggle_device(url: URL, slug: string): URL {
	const current = url.searchParams.get("device") ?? ""
	return update_param(url, "device", current === slug ? null : slug)
}

function toggle_source(url: URL, source: string): URL {
	const current = url.searchParams.get("source") ?? ""
	return update_param(url, "source", current === source ? null : source)
}

function toggle_favorited(url: URL): URL {
	const current = url.searchParams.get("favorited") === "true"
	return update_param(url, "favorited", current ? null : "true")
}

function toggle_nsfw(url: URL, value: string): URL {
	const current = url.searchParams.get("nsfw") ?? ""
	return update_param(url, "nsfw", current === value ? null : value)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const base_url = () => new URL("http://localhost:5173/")

describe("FilterChips — device toggle", () => {
	test("first toggle sets ?device=slug", () => {
		const result = toggle_device(base_url(), "phone-pixel")
		expect(result.searchParams.get("device")).toBe("phone-pixel")
	})

	test("second toggle on same slug removes ?device", () => {
		const url = new URL("http://localhost:5173/?device=phone-pixel")
		const result = toggle_device(url, "phone-pixel")
		expect(result.searchParams.get("device")).toBeNull()
	})

	test("toggle to a different device replaces the param", () => {
		const url = new URL("http://localhost:5173/?device=phone-pixel")
		const result = toggle_device(url, "desktop-4k")
		expect(result.searchParams.get("device")).toBe("desktop-4k")
	})
})

describe("FilterChips — source toggle", () => {
	test("first toggle sets ?source=name", () => {
		const result = toggle_source(base_url(), "reddit")
		expect(result.searchParams.get("source")).toBe("reddit")
	})

	test("second toggle on same source removes ?source", () => {
		const url = new URL("http://localhost:5173/?source=reddit")
		const result = toggle_source(url, "reddit")
		expect(result.searchParams.get("source")).toBeNull()
	})
})

describe("FilterChips — favorites toggle", () => {
	test("toggles ?favorited=true on", () => {
		const result = toggle_favorited(base_url())
		expect(result.searchParams.get("favorited")).toBe("true")
	})

	test("toggles ?favorited off when already on", () => {
		const url = new URL("http://localhost:5173/?favorited=true")
		const result = toggle_favorited(url)
		expect(result.searchParams.get("favorited")).toBeNull()
	})
})

describe("FilterChips — nsfw toggle", () => {
	test("sets ?nsfw=sfw_only", () => {
		const result = toggle_nsfw(base_url(), "sfw_only")
		expect(result.searchParams.get("nsfw")).toBe("sfw_only")
	})

	test("removes ?nsfw when same value toggled again", () => {
		const url = new URL("http://localhost:5173/?nsfw=sfw_only")
		const result = toggle_nsfw(url, "sfw_only")
		expect(result.searchParams.get("nsfw")).toBeNull()
	})

	test("sets ?nsfw=nsfw_only", () => {
		const result = toggle_nsfw(base_url(), "nsfw_only")
		expect(result.searchParams.get("nsfw")).toBe("nsfw_only")
	})
})

describe("FilterChips — pagination reset", () => {
	test("clears ?next on filter change", () => {
		const url = new URL("http://localhost:5173/?next=01950000-0000-7000-8000-aaa")
		const result = toggle_device(url, "phone-pixel")
		expect(result.searchParams.get("next")).toBeNull()
	})

	test("clears ?prev on filter change", () => {
		const url = new URL("http://localhost:5173/?prev=01950000-0000-7000-8000-bbb")
		const result = toggle_source(url, "reddit")
		expect(result.searchParams.get("prev")).toBeNull()
	})
})

describe("FilterChips — parse_filter", () => {
	test("parses all filter params from URL", () => {
		const url = new URL(
			"http://localhost:5173/?device=phone&source=reddit&favorited=true&nsfw=sfw_only",
		)
		const state = parse_filter(url)
		expect(state.device).toBe("phone")
		expect(state.source).toBe("reddit")
		expect(state.favorited).toBe(true)
		expect(state.nsfw).toBe("sfw_only")
	})

	test("returns empty defaults when no params set", () => {
		const state = parse_filter(base_url())
		expect(state.device).toBe("")
		expect(state.source).toBe("")
		expect(state.favorited).toBe(false)
		expect(state.nsfw).toBe("")
	})
})
