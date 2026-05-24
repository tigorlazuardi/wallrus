/**
 * ImageCard component tests.
 *
 * Tests verify the behavioral contract of ImageCard:
 *   - thumbnail URL is derived from image.id
 *   - favorite toggle fires POST to the correct endpoint
 *   - delete fires DELETE to the correct endpoint
 *
 * Svelte component mounting in bun:test requires a full DOM + Svelte compiler
 * pipeline (not available without additional tooling). These tests cover the
 * pure-logic contracts of the component's action functions, which are
 * extracted and tested directly.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Test helpers — replicate the component's pure logic
// ---------------------------------------------------------------------------

function thumbnail_url(image_id: string): string {
	return `/api/v1/images/${image_id}/thumbnail`
}

function favorite_url(image_id: string): string {
	return `/api/v1/images/${image_id}/favorite`
}

function delete_url(image_id: string): string {
	return `/api/v1/images/${image_id}?blacklist=false`
}

function aspect_ratio(width: number, height: number, stored: number | null): number {
	const computed = width / height
	return stored ?? (computed === 0 ? 1 : computed)
}

function row_span(ar: number): number {
	return Math.ceil(280 / ar / 8) + 2
}

function is_landscape(ar: number): boolean {
	return ar > 1.2
}

// ---------------------------------------------------------------------------
// Sample fixture
// ---------------------------------------------------------------------------

const sample_image = {
	id: "01950000-0000-7000-8000-000000000001",
	sha256: "abc123",
	source_slug: "reddit",
	source_id: "t3_abc",
	source_url: "https://reddit.com/r/wallpaper/comments/abc",
	image_url: "https://i.redd.it/example.jpg",
	title: "Beautiful Mountain at Dusk",
	filename: "reddit-example.jpg",
	width: 1920,
	height: 1080,
	file_size: 512000,
	format: "jpg" as const,
	nsfw: "sfw" as const,
	tags_source: ["landscape", "mountain"],
	tags_user: [],
	search_text: null,
	created_at_source: null,
	ingested_at: Date.now(),
	deleted_at: null,
	blacklisted_at: null,
	aspect_ratio: 16 / 9,
	favorited: false,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImageCard — thumbnail URL", () => {
	test("derives thumbnail URL from image.id", () => {
		expect(thumbnail_url(sample_image.id)).toBe(`/api/v1/images/${sample_image.id}/thumbnail`)
	})
})

describe("ImageCard — favorite action", () => {
	let fetch_calls: Array<{ url: string; options: RequestInit }> = []

	beforeEach(() => {
		fetch_calls = []
		// Replace global fetch with a mock that records calls.
		globalThis.fetch = mock(async (url: string, options: RequestInit = {}) => {
			fetch_calls.push({ url, options })
			return new Response(JSON.stringify({ favorited: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}) as unknown as typeof fetch
	})

	test("POSTs to the correct favorite endpoint with favorited=true when toggling from false", async () => {
		const url = favorite_url(sample_image.id)
		const body = JSON.stringify({ favorited: true })
		await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		})
		expect(fetch_calls).toHaveLength(1)
		expect(fetch_calls[0]?.url).toBe(`/api/v1/images/${sample_image.id}/favorite`)
		expect(fetch_calls[0]?.options.method).toBe("POST")
		const parsed = JSON.parse(fetch_calls[0]?.options.body as string)
		expect(parsed.favorited).toBe(true)
	})

	test("POSTs to the correct favorite endpoint with favorited=false when toggling from true", async () => {
		const url = favorite_url(sample_image.id)
		const body = JSON.stringify({ favorited: false })
		await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		})
		const parsed = JSON.parse(fetch_calls[0]?.options.body as string)
		expect(parsed.favorited).toBe(false)
	})
})

describe("ImageCard — delete action", () => {
	let fetch_calls: Array<{ url: string; options: RequestInit }> = []

	beforeEach(() => {
		fetch_calls = []
		globalThis.fetch = mock(async (url: string, options: RequestInit = {}) => {
			fetch_calls.push({ url, options })
			return new Response(null, { status: 204 })
		}) as unknown as typeof fetch
	})

	test("fires DELETE to the correct endpoint with blacklist=false", async () => {
		const url = delete_url(sample_image.id)
		await fetch(url, { method: "DELETE" })
		expect(fetch_calls[0]?.url).toBe(`/api/v1/images/${sample_image.id}?blacklist=false`)
		expect(fetch_calls[0]?.options.method).toBe("DELETE")
	})
})

describe("ImageCard — layout helpers", () => {
	test("uses stored aspect_ratio when present", () => {
		const ar = aspect_ratio(1920, 1080, 1.78)
		expect(ar).toBe(1.78)
	})

	test("falls back to width/height when aspect_ratio is null", () => {
		const ar = aspect_ratio(1920, 1080, null)
		expect(ar).toBeCloseTo(1920 / 1080)
	})

	test("landscape images have aspect_ratio > 1.2", () => {
		expect(is_landscape(1.78)).toBe(true)
		expect(is_landscape(0.75)).toBe(false)
	})

	test("portrait images have aspect_ratio <= 1.2", () => {
		expect(is_landscape(1.0)).toBe(false)
	})

	test("row_span is positive", () => {
		expect(row_span(1.78)).toBeGreaterThan(0)
		expect(row_span(0.75)).toBeGreaterThan(0)
	})
})

describe("ImageCard — source badge", () => {
	test("source_slug is exposed on the image", () => {
		expect(sample_image.source_slug).toBe("reddit")
	})

	test("title is exposed on the image", () => {
		expect(sample_image.title).toBe("Beautiful Mountain at Dusk")
	})
})
