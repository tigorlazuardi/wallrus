/**
 * Unit tests for $lib/client/images/use-image-mutation.svelte.ts
 *
 * The mutation hook has no internal $state — it is a plain function that
 * returns action functions. We test each action (toggleFavorite, softDelete,
 * blacklist, restore, addTag, removeTag) by stubbing globalThis.fetch and
 * verifying:
 *   - Correct HTTP method + path
 *   - Correct request body / query params
 *   - Response is parsed by the appropriate Zod schema
 *   - Non-OK HTTP responses throw with an HTTP status message
 *   - Network errors propagate as-thrown
 */

import { afterEach, describe, expect, test } from "bun:test"
import { set_api_base } from "$lib/client/config"

// ---------------------------------------------------------------------------
// Fake fetch
// ---------------------------------------------------------------------------

type FetchCall = { url: string; method: string; body: unknown }
type FetchStub = (url: string, init?: RequestInit) => Promise<Response>

let _fetch_stub: FetchStub | null = null
const _calls: FetchCall[] = []

const original_fetch = globalThis.fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = (
	url: string | URL | Request,
	init?: RequestInit,
): Promise<Response> => {
	let body: unknown = undefined
	try {
		if (init?.body) body = JSON.parse(init.body as string)
	} catch {
		body = init?.body
	}
	_calls.push({ url: String(url), method: init?.method ?? "GET", body })
	if (_fetch_stub) return _fetch_stub(String(url), init)
	return original_fetch(url as string, init)
}

afterEach(() => {
	_fetch_stub = null
	_calls.splice(0)
	set_api_base("")
})

// ---------------------------------------------------------------------------
// Import hook (no $state, so static import is fine)
// ---------------------------------------------------------------------------

import { useImageMutation } from "$lib/client/images/use-image-mutation.svelte"

// ---------------------------------------------------------------------------
// Sample data fixtures
// ---------------------------------------------------------------------------

const image_id = "018f7e1a-1234-7000-8000-000000000001"

function make_image(id: string) {
	return {
		id,
		sha256: "abc123",
		source_slug: "reddit",
		source_id: "t3_abc",
		source_url: `https://reddit.com/img/${id}`,
		image_url: `https://i.redd.it/${id}.jpg`,
		title: "Test image",
		filename: `${id}.jpg`,
		width: 1920,
		height: 1080,
		file_size: 500_000,
		format: "jpg" as const,
		nsfw: "sfw" as const,
		tags_source: [],
		tags_user: [],
		search_text: null,
		created_at_source: null,
		ingested_at: 1_700_000_000_000,
		deleted_at: null,
		blacklisted_at: null,
		aspect_ratio: 1.778,
		favorited: false,
	}
}

const sample_image = make_image(image_id)

function ok_json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

// ---------------------------------------------------------------------------
// toggleFavorite()
// ---------------------------------------------------------------------------

describe("useImageMutation().toggleFavorite", () => {
	test("POST to /api/v1/images/[id]/favorite", async () => {
		_fetch_stub = () => Promise.resolve(ok_json({ ...sample_image, favorited: true }))
		const { toggleFavorite } = useImageMutation()
		await toggleFavorite(image_id, true)
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}/favorite`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends { favorited: true } in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json({ ...sample_image, favorited: true }))
		const { toggleFavorite } = useImageMutation()
		await toggleFavorite(image_id, true)
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.favorited).toBe(true)
	})

	test("sends { favorited: false } in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json({ ...sample_image, favorited: false }))
		const { toggleFavorite } = useImageMutation()
		await toggleFavorite(image_id, false)
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.favorited).toBe(false)
	})

	test("returns parsed image with favorited state", async () => {
		const favorited_image = { ...sample_image, favorited: true }
		_fetch_stub = () => Promise.resolve(ok_json(favorited_image))
		const { toggleFavorite } = useImageMutation()
		const result = await toggleFavorite(image_id, true)
		expect(result.favorited).toBe(true)
		expect(result.id).toBe(image_id)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { toggleFavorite } = useImageMutation()
		await expect(toggleFavorite(image_id, true)).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { toggleFavorite } = useImageMutation()
		await expect(toggleFavorite(image_id, true)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// softDelete()
// ---------------------------------------------------------------------------

describe("useImageMutation().softDelete", () => {
	test("DELETE to /api/v1/images/[id]?blacklist=false", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { softDelete } = useImageMutation()
		await softDelete(image_id)
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}?blacklist=false`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("returns void on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { softDelete } = useImageMutation()
		const result = await softDelete(image_id)
		expect(result).toBeUndefined()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { softDelete } = useImageMutation()
		await expect(softDelete(image_id)).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { softDelete } = useImageMutation()
		await expect(softDelete(image_id)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// blacklist()
// ---------------------------------------------------------------------------

describe("useImageMutation().blacklist", () => {
	test("DELETE to /api/v1/images/[id]?blacklist=true", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { blacklist } = useImageMutation()
		await blacklist(image_id)
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}?blacklist=true`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("returns void on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { blacklist } = useImageMutation()
		const result = await blacklist(image_id)
		expect(result).toBeUndefined()
	})

	test("blacklist uses ?blacklist=true (distinct from softDelete ?blacklist=false)", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const mutation = useImageMutation()
		await mutation.blacklist(image_id)
		expect(_calls[0]!.url).toContain("blacklist=true")
		expect(_calls[0]!.url).not.toContain("blacklist=false")
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("server error", { status: 500 }))
		const { blacklist } = useImageMutation()
		await expect(blacklist(image_id)).rejects.toThrow(/HTTP 500/)
	})
})

// ---------------------------------------------------------------------------
// restore()
// ---------------------------------------------------------------------------

describe("useImageMutation().restore", () => {
	test("POST to /api/v1/images/[id]/restore", async () => {
		const restored = { ...sample_image, deleted_at: null }
		_fetch_stub = () => Promise.resolve(ok_json(restored))
		const { restore } = useImageMutation()
		await restore(image_id)
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}/restore`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("returns parsed image from response", async () => {
		const restored = { ...sample_image, deleted_at: null }
		_fetch_stub = () => Promise.resolve(ok_json(restored))
		const { restore } = useImageMutation()
		const result = await restore(image_id)
		expect(result.id).toBe(image_id)
		expect(result.deleted_at).toBeNull()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("bad request", { status: 400 }))
		const { restore } = useImageMutation()
		await expect(restore(image_id)).rejects.toThrow(/HTTP 400/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("timeout"))
		const { restore } = useImageMutation()
		await expect(restore(image_id)).rejects.toThrow("timeout")
	})
})

// ---------------------------------------------------------------------------
// addTag()
// ---------------------------------------------------------------------------

describe("useImageMutation().addTag", () => {
	const tag_response = {
		image_id,
		tag: "landscape",
		created_at: 1_700_000_000_000,
	}

	test("POST to /api/v1/images/[id]/tags", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(tag_response))
		const { addTag } = useImageMutation()
		await addTag(image_id, "landscape")
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}/tags`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends { tag } in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(tag_response))
		const { addTag } = useImageMutation()
		await addTag(image_id, "landscape")
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.tag).toBe("landscape")
	})

	test("returns parsed AddTagResponse", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(tag_response))
		const { addTag } = useImageMutation()
		const result = await addTag(image_id, "landscape")
		expect(result.image_id).toBe(image_id)
		expect(result.tag).toBe("landscape")
		expect(result.created_at).toBe(1_700_000_000_000)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("bad request", { status: 400 }))
		const { addTag } = useImageMutation()
		await expect(addTag(image_id, "landscape")).rejects.toThrow(/HTTP 400/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { addTag } = useImageMutation()
		await expect(addTag(image_id, "landscape")).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// removeTag()
// ---------------------------------------------------------------------------

describe("useImageMutation().removeTag", () => {
	test("DELETE to /api/v1/images/[id]/tags/[tag]", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { removeTag } = useImageMutation()
		await removeTag(image_id, "landscape")
		expect(_calls[0]!.url).toBe(`/api/v1/images/${image_id}/tags/landscape`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("encodes special characters in tag path segment", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { removeTag } = useImageMutation()
		await removeTag(image_id, "sci fi")
		expect(_calls[0]!.url).toContain("sci%20fi")
	})

	test("returns void on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { removeTag } = useImageMutation()
		const result = await removeTag(image_id, "landscape")
		expect(result).toBeUndefined()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { removeTag } = useImageMutation()
		await expect(removeTag(image_id, "landscape")).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { removeTag } = useImageMutation()
		await expect(removeTag(image_id, "landscape")).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// General — api_base propagation
// ---------------------------------------------------------------------------

describe("useImageMutation — api_base propagation", () => {
	test("all actions prepend api_base when set", async () => {
		set_api_base("http://10.0.0.1:5173")
		_fetch_stub = (url) => {
			if (url.includes("/restore")) return Promise.resolve(ok_json(sample_image))
			if (url.includes("/favorite")) return Promise.resolve(ok_json(sample_image))
			if (url.includes("/tags/")) return Promise.resolve(new Response(null, { status: 204 }))
			if (url.includes("/tags")) {
				return Promise.resolve(
					ok_json({ image_id, tag: "t", created_at: 1_700_000_000_000 }),
				)
			}
			return Promise.resolve(new Response(null, { status: 204 }))
		}

		const { toggleFavorite, softDelete, blacklist, restore, addTag, removeTag } =
			useImageMutation()

		_calls.splice(0)
		await toggleFavorite(image_id, true)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await softDelete(image_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await blacklist(image_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await restore(image_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await addTag(image_id, "test")
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await removeTag(image_id, "test")
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)
	})
})
