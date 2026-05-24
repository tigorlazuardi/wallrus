import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { get_source, sources } from "./_registry"
import type { SourceContext } from "./_types"
import reddit_module, { RedditInputSchema } from "./reddit"

import listing_fixture from "./__fixtures__/reddit/listing.json"
import gallery_fixture from "./__fixtures__/reddit/gallery.json"
import token_fixture from "./__fixtures__/reddit/token.json"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_CREDENTIAL = {
	client_id: "test-client-id",
	client_secret: "test-client-secret",
	user_agent: "wallrus-test/1.0",
}

const VALID_INPUT = RedditInputSchema.parse({
	subreddit: "wallpapers",
	sort: "hot",
	limit_per_page: 100,
})

function make_stub_ctx(overrides?: Partial<SourceContext>): SourceContext {
	return {
		log: () => {},
		abort: new AbortController().signal,
		http_get_json: async () => ({}),
		http_get_bytes: async () => new Uint8Array(),
		http_post_form: async () => token_fixture,
		...overrides,
	}
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const items: T[] = []
	for await (const item of gen) {
		items.push(item)
	}
	return items
}

// ---------------------------------------------------------------------------
// Module shape
// ---------------------------------------------------------------------------

describe("reddit module", () => {
	test("slug is reddit", () => {
		expect(reddit_module.slug).toBe("reddit")
	})

	test("display_name is Reddit", () => {
		expect(reddit_module.display_name).toBe("Reddit")
	})

	test("has credential schema", () => {
		expect(reddit_module.credential).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("RedditInputSchema", () => {
	test("validates a real-looking input", () => {
		const result = RedditInputSchema.safeParse({
			subreddit: "wallpapers",
			sort: "top",
			time: "week",
			limit_per_page: 50,
		})
		expect(result.success).toBe(true)
	})

	test("rejects invalid subreddit name (too short)", () => {
		const result = RedditInputSchema.safeParse({ subreddit: "a" })
		expect(result.success).toBe(false)
	})

	test("rejects invalid subreddit name (special chars)", () => {
		const result = RedditInputSchema.safeParse({ subreddit: "wall-papers" })
		expect(result.success).toBe(false)
	})

	test("applies defaults for sort and limit_per_page", () => {
		const result = RedditInputSchema.safeParse({ subreddit: "wallpapers" })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.sort).toBe("hot")
			expect(result.data.limit_per_page).toBe(100)
		}
	})

	test("rejects extra keys (strict)", () => {
		const result = RedditInputSchema.safeParse({
			subreddit: "wallpapers",
			extra_key: "value",
		})
		expect(result.success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Missing credentials
// ---------------------------------------------------------------------------

describe("missing credentials", () => {
	test("throws AppError when credential is undefined", async () => {
		const ctx = make_stub_ctx()
		const gen = reddit_module.fetch(ctx, VALID_INPUT, undefined)
		let thrown: unknown
		try {
			await gen.next()
		} catch (err) {
			thrown = err
		}
		expect(thrown).toBeInstanceOf(AppError)
		const ae = thrown as AppError
		expect(ae.message).toContain("source.credentials_missing")
	})
})

// ---------------------------------------------------------------------------
// Token fetch
// ---------------------------------------------------------------------------

describe("token fetch", () => {
	test("happy path: fetches token and proceeds to listing", async () => {
		let token_requested = false
		const ctx = make_stub_ctx({
			http_post_form: async (url) => {
				expect(url).toBe("https://www.reddit.com/api/v1/access_token")
				token_requested = true
				return token_fixture
			},
			http_get_json: async () => listing_fixture,
		})

		await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		expect(token_requested).toBe(true)
	})

	test("token response is invalid JSON shape → throws helpful error", async () => {
		const ctx = make_stub_ctx({
			http_post_form: async () => {
				// Simulate Reddit returning HTML error page instead of JSON.
				// The http_post_form contract says it returns parsed unknown.
				// If the token doesn't have access_token, our schema parse fails.
				return { error: "invalid_client" }
			},
			http_get_json: async () => listing_fixture,
		})

		let thrown: unknown
		try {
			await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		} catch (err) {
			thrown = err
		}
		expect(thrown).toBeInstanceOf(AppError)
		const ae = thrown as AppError
		expect(ae.message).toContain("source.reddit.token_invalid")
	})
})

// ---------------------------------------------------------------------------
// Single-post mapping
// ---------------------------------------------------------------------------

describe("single post mapping", () => {
	test("yields one SourceItem with expected fields", async () => {
		// listing_fixture has: [image post sfw, self post, nsfw image post]
		const ctx = make_stub_ctx({
			http_get_json: async () => listing_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))

		// 2 image posts (abc111 sfw, abc333 nsfw) — self post skipped
		expect(items.length).toBe(2)

		const first = items[0]!
		expect(first.source_id).toBe("abc111")
		expect(first.title).toBe("Beautiful mountain at sunset")
		expect(first.source_url).toBe(
			"https://www.reddit.com/r/wallpapers/comments/abc111/beautiful_mountain_at_sunset/",
		)
		expect(first.image_url).toBe("https://i.example.com/wallpapers/mountain_sunset.jpg")
		expect(first.filename).toBe("abc111")
		expect(first.nsfw).toBe("sfw")
		expect(first.tags).toEqual([])
	})

	test("non-image post (self) is skipped", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => listing_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))

		// abc222 is a self post — should not appear
		const ids = items.map((i) => i.source_id)
		expect(ids).not.toContain("abc222")
	})
})

// ---------------------------------------------------------------------------
// NSFW mapping
// ---------------------------------------------------------------------------

describe("NSFW mapping", () => {
	test("over_18=false maps to sfw", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => listing_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		const sfw_item = items.find((i) => i.source_id === "abc111")
		expect(sfw_item?.nsfw).toBe("sfw")
	})

	test("over_18=true maps to nsfw", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => listing_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		const nsfw_item = items.find((i) => i.source_id === "abc333")
		expect(nsfw_item?.nsfw).toBe("nsfw")
	})
})

// ---------------------------------------------------------------------------
// Gallery expansion
// ---------------------------------------------------------------------------

describe("gallery expansion", () => {
	test("gallery post yields N items in gallery_data.items order", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => gallery_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		expect(items.length).toBe(2)

		// First item: imgabc (order from gallery_data.items)
		const item0 = items[0]!
		const item1 = items[1]!
		expect(item0.source_id).toBe("gal001_imgabc")
		expect(item0.filename).toBe("gal001_imgabc")
		expect(item0.title).toBe("Space photography collection [gallery]")
		expect(item0.source_url).toBe(
			"https://www.reddit.com/r/wallpapers/comments/gal001/space_photography_collection_gallery/",
		)
		expect(item0.nsfw).toBe("sfw")
		expect(item0.width).toBe(3840)
		expect(item0.height).toBe(2160)

		// Second item: imgdef
		expect(item1.source_id).toBe("gal001_imgdef")
		expect(item1.filename).toBe("gal001_imgdef")
		expect(item1.width).toBe(2560)
		expect(item1.height).toBe(1440)
	})

	test("gallery image_url decodes HTML-encoded ampersands", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => gallery_fixture,
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		// Fixture uses &amp; in preview URLs; they should be decoded to &
		for (const item of items) {
			expect(item.image_url).not.toContain("&amp;")
		}
	})
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
	test("follows after cursor across two pages, stops on null", async () => {
		const page1 = {
			kind: "Listing",
			data: {
				after: "t3_page2cursor",
				dist: 1,
				children: [
					{
						kind: "t3",
						data: {
							id: "p1post1",
							name: "t3_p1post1",
							title: "Page 1 wallpaper",
							subreddit: "wallpapers",
							permalink: "/r/wallpapers/comments/p1post1/page_1_wallpaper/",
							url: "https://i.example.com/p1.jpg",
							post_hint: "image",
							is_gallery: false,
							over_18: false,
							created_utc: 1716840000,
						},
					},
				],
			},
		}

		const page2 = {
			kind: "Listing",
			data: {
				after: null,
				dist: 1,
				children: [
					{
						kind: "t3",
						data: {
							id: "p2post1",
							name: "t3_p2post1",
							title: "Page 2 wallpaper",
							subreddit: "wallpapers",
							permalink: "/r/wallpapers/comments/p2post1/page_2_wallpaper/",
							url: "https://i.example.com/p2.png",
							post_hint: "image",
							is_gallery: false,
							over_18: false,
							created_utc: 1716843600,
						},
					},
				],
			},
		}

		let call_count = 0
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				call_count++
				if (call_count === 1) {
					// First page — no `after` param
					expect(url).not.toContain("after=")
					return page1
				}
				// Second page — must have `after` param
				expect(url).toContain("after=t3_page2cursor")
				return page2
			},
		})

		const items = await collect(reddit_module.fetch(ctx, VALID_INPUT, VALID_CREDENTIAL))
		expect(call_count).toBe(2)
		expect(items.length).toBe(2)
		expect(items[0]!.source_id).toBe("p1post1")
		expect(items[1]!.source_id).toBe("p2post1")
	})
})

// ---------------------------------------------------------------------------
// Registry interaction
// ---------------------------------------------------------------------------

describe("registry interaction", () => {
	test("register_reddit adds entry accessible via get_source", async () => {
		// Import and call register_reddit to ensure the module is registered.
		const { register_reddit } = await import("./reddit")
		register_reddit()
		const entry = get_source("reddit")
		expect(entry).toBeDefined()
		expect(entry?.slug).toBe("reddit")
	})

	test("sources map contains reddit after registration", () => {
		expect(sources["reddit"]).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Rate-limit test — SKIPPED (header-aware HTTP not implemented this slice)
// See plans/007-source-reddit/.builder-notes.md §Rate-limit headers deferred
// ---------------------------------------------------------------------------

test.skip("rate-limit: sleeps when X-Ratelimit-Remaining < 5", () => {
	// Requires http_get_json_with_headers — deferred to a future slice.
	// When implemented, assert that Bun.sleep is called with the correct ms
	// derived from X-Ratelimit-Reset header value.
})
