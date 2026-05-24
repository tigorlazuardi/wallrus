import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { get_source, register_sources, sources } from "./_registry"
import type { SourceContext } from "./_types"
import booru_module, { BooruInputSchema } from "./booru"

import danbooru_fixture from "./__fixtures__/booru/danbooru-posts.json"
import gelbooru_fixture from "./__fixtures__/booru/gelbooru-posts.json"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const DANBOORU_INPUT = BooruInputSchema.parse({
	variant: "danbooru",
	host: "https://danbooru.donmai.us",
	tags: ["sky", "clouds"],
	limit_per_page: 50,
	rating: "any",
})

const GELBOORU_INPUT = BooruInputSchema.parse({
	variant: "gelbooru",
	host: "https://gelbooru.com",
	tags: ["sky", "clouds"],
	limit_per_page: 50,
	rating: "any",
})

function make_stub_ctx(overrides?: Partial<SourceContext>): SourceContext {
	return {
		log: () => {},
		abort: new AbortController().signal,
		http_get_json: async () => [],
		http_get_bytes: async () => new Uint8Array(),
		http_post_form: async () => ({}),
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

describe("booru module", () => {
	test("slug is booru", () => {
		expect(booru_module.slug).toBe("booru")
	})

	test("display_name is Booru", () => {
		expect(booru_module.display_name).toBe("Booru")
	})

	test("has credential schema", () => {
		expect(booru_module.credential).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("BooruInputSchema", () => {
	test("validates danbooru input", () => {
		const result = BooruInputSchema.safeParse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: ["wallpaper"],
			rating: "s",
		})
		expect(result.success).toBe(true)
	})

	test("validates gelbooru input", () => {
		const result = BooruInputSchema.safeParse({
			variant: "gelbooru",
			host: "https://gelbooru.com",
			tags: [],
			rating: "any",
		})
		expect(result.success).toBe(true)
	})

	test("rejects invalid variant", () => {
		const result = BooruInputSchema.safeParse({
			variant: "e621",
			host: "https://e621.net",
			tags: [],
		})
		expect(result.success).toBe(false)
	})

	test("rejects too many tags (> 10)", () => {
		const result = BooruInputSchema.safeParse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
		})
		expect(result.success).toBe(false)
	})

	test("rejects extra keys (strict)", () => {
		const result = BooruInputSchema.safeParse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: [],
			extra_key: "value",
		})
		expect(result.success).toBe(false)
	})

	test("applies defaults for limit_per_page and rating", () => {
		const result = BooruInputSchema.safeParse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: [],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.limit_per_page).toBe(50)
			expect(result.data.rating).toBe("any")
		}
	})
})

// ---------------------------------------------------------------------------
// Danbooru happy path
// ---------------------------------------------------------------------------

describe("danbooru happy path", () => {
	test("3 posts → 2 SourceItems (one skipped for null file_url)", async () => {
		let call_count = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call_count++
				if (call_count === 1) return danbooru_fixture
				return [] // second page empty, stops loop
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items.length).toBe(2)
	})

	test("source_id is string form of post id", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? danbooru_fixture.slice(0, 1) : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.source_id).toBe("1001")
	})

	test("source_url uses danbooru format: host/posts/id", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? danbooru_fixture : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.source_url).toBe("https://danbooru.donmai.us/posts/1001")
	})

	test("tags concatenated from all 4 tag_string_* columns", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				// post 1002 has general + character + copyright + artist tags
				return call === 1 ? [danbooru_fixture[1]] : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items.length).toBe(1)
		const tags = items[0]!.tags
		expect(tags).toContain("forest")
		expect(tags).toContain("trees")
		expect(tags).toContain("character1")
		expect(tags).toContain("series1")
		expect(tags).toContain("artist2")
	})

	test("tags are lowercased and deduped", async () => {
		const post_with_dupes = {
			...danbooru_fixture[0],
			tag_string_general: "sky Sky SKY",
			tag_string_character: "",
			tag_string_copyright: "",
			tag_string_artist: "sky", // duplicate
		}
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [post_with_dupes] : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		const sky_count = items[0]!.tags.filter((t) => t === "sky").length
		expect(sky_count).toBe(1)
	})

	test("width, height, file_size are mapped when present", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [danbooru_fixture[0]] : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.width).toBe(3840)
		expect(items[0]!.height).toBe(2160)
		expect(items[0]!.file_size).toBe(2048576)
	})

	test("format is extracted from file_url extension", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [danbooru_fixture[0]] : []
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.format).toBe("jpg")
	})
})

// ---------------------------------------------------------------------------
// Gelbooru happy path
// ---------------------------------------------------------------------------

describe("gelbooru happy path", () => {
	test("3 posts → 3 SourceItems (none have null file_url)", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? gelbooru_fixture : { post: [] }
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(items.length).toBe(3)
	})

	test("source_url uses gelbooru format: host/index.php?page=post&s=view&id=N", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? gelbooru_fixture : { post: [] }
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(items[0]!.source_url).toBe("https://gelbooru.com/index.php?page=post&s=view&id=2001")
	})

	test("tags split from space-separated tags string", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? gelbooru_fixture : { post: [] }
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		const first = items[0]!
		expect(first.tags).toContain("sky")
		expect(first.tags).toContain("clouds")
		expect(first.tags).toContain("mountain")
		expect(first.tags).toContain("scenery")
		expect(first.tags).toContain("wallpaper")
	})

	test("width and height are mapped when present", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? { post: [gelbooru_fixture.post[0]] } : { post: [] }
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(items[0]!.width).toBe(1920)
		expect(items[0]!.height).toBe(1080)
	})

	test("gelbooru posts (legacy) wrapper also works", async () => {
		const legacy_response = {
			posts: gelbooru_fixture.post,
		}
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? legacy_response : { posts: [] }
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(items.length).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// Rating filter
// ---------------------------------------------------------------------------

describe("rating filter", () => {
	test("rating: 's' appends rating:s to URL", async () => {
		const input = BooruInputSchema.parse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: ["sky"],
			rating: "s",
		})
		const urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				urls.push(url)
				return []
			},
		})

		await collect(booru_module.fetch(ctx, input))
		expect(urls[0]).toContain("rating%3As") // URL-encoded "rating:s"
	})

	test("rating: 'any' does NOT append rating: token to URL", async () => {
		const input = BooruInputSchema.parse({
			variant: "danbooru",
			host: "https://danbooru.donmai.us",
			tags: ["sky"],
			rating: "any",
		})
		const urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				urls.push(url)
				return []
			},
		})

		await collect(booru_module.fetch(ctx, input))
		expect(urls[0]).not.toContain("rating")
	})

	test("gelbooru: rating 'q' appended to URL", async () => {
		const input = BooruInputSchema.parse({
			variant: "gelbooru",
			host: "https://gelbooru.com",
			tags: ["forest"],
			rating: "q",
		})
		const urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				urls.push(url)
				return { post: [] }
			},
		})

		await collect(booru_module.fetch(ctx, input))
		expect(urls[0]).toContain("rating%3Aq")
	})
})

// ---------------------------------------------------------------------------
// NSFW mapping
// ---------------------------------------------------------------------------

describe("NSFW mapping", () => {
	function make_danbooru_post(rating: string) {
		return {
			id: 9999,
			created_at: "2024-01-01T00:00:00.000Z",
			rating,
			file_url: "https://cdn.example.com/test.jpg",
			file_size: 1024,
			image_width: 1920,
			image_height: 1080,
			tag_string_general: "test",
			tag_string_character: "",
			tag_string_copyright: "",
			tag_string_artist: "",
		}
	}

	test("rating 's' maps to sfw", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [make_danbooru_post("s")] : []
			},
		})
		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.nsfw).toBe("sfw")
	})

	test("rating 'g' maps to sfw (newer danbooru)", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [make_danbooru_post("g")] : []
			},
		})
		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.nsfw).toBe("sfw")
	})

	test("rating 'q' maps to nsfw", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [make_danbooru_post("q")] : []
			},
		})
		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.nsfw).toBe("nsfw")
	})

	test("rating 'e' maps to nsfw", async () => {
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [make_danbooru_post("e")] : []
			},
		})
		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items[0]!.nsfw).toBe("nsfw")
	})
})

// ---------------------------------------------------------------------------
// GIF skipping
// ---------------------------------------------------------------------------

describe("gif skipping", () => {
	test("danbooru: .gif posts are skipped", async () => {
		const gif_post = {
			id: 5001,
			created_at: "2024-01-01T00:00:00.000Z",
			rating: "s",
			file_url: "https://cdn.example.com/animation.gif",
			file_size: 4096,
			image_width: 800,
			image_height: 600,
			tag_string_general: "animated",
			tag_string_character: "",
			tag_string_copyright: "",
			tag_string_artist: "",
		}
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? [gif_post] : []
			},
		})
		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(items.length).toBe(0)
	})

	test("gelbooru: .gif posts are skipped", async () => {
		const gif_post = {
			id: 5002,
			created_at: "Mon Jan 01 00:00:00 -0500 2024",
			rating: "s",
			file_url: "https://img.example.com/animation.gif",
			width: 800,
			height: 600,
			image: "animation.gif",
			tags: "animated loop",
		}
		let call = 0
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				call++
				return call === 1 ? { post: [gif_post] } : { post: [] }
			},
		})
		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(items.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
	test("danbooru: page starts at 1, increments, stops on empty", async () => {
		const page_urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				page_urls.push(url)
				if (page_urls.length === 1) {
					return [
						{
							id: 100,
							created_at: "2024-01-01T00:00:00.000Z",
							rating: "s",
							file_url: "https://cdn.example.com/100.jpg",
							file_size: 1024,
							image_width: 1920,
							image_height: 1080,
							tag_string_general: "test",
							tag_string_character: "",
							tag_string_copyright: "",
							tag_string_artist: "",
						},
					]
				}
				return [] // second page empty
			},
		})

		const items = await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		expect(page_urls.length).toBe(2)
		expect(page_urls[0]).toContain("page=1")
		expect(page_urls[1]).toContain("page=2")
		expect(items.length).toBe(1)
	})

	test("gelbooru: pid starts at 0, increments, stops on empty", async () => {
		const page_urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				page_urls.push(url)
				if (page_urls.length === 1) {
					return {
						post: [
							{
								id: 200,
								created_at: "Mon Jan 01 00:00:00 -0500 2024",
								rating: "s",
								file_url: "https://img.example.com/200.jpg",
								width: 1920,
								height: 1080,
								image: "200.jpg",
								tags: "test",
							},
						],
					}
				}
				return { post: [] } // second page empty
			},
		})

		const items = await collect(booru_module.fetch(ctx, GELBOORU_INPUT))
		expect(page_urls.length).toBe(2)
		expect(page_urls[0]).toContain("pid=0")
		expect(page_urls[1]).toContain("pid=1")
		expect(items.length).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
	test("http_get_json throwing re-throws as AppError", async () => {
		const ctx = make_stub_ctx({
			http_get_json: async () => {
				throw new Error("network error")
			},
		})

		let thrown: unknown
		try {
			await collect(booru_module.fetch(ctx, DANBOORU_INPUT))
		} catch (err) {
			thrown = err
		}
		expect(thrown).toBeInstanceOf(AppError)
	})
})

// ---------------------------------------------------------------------------
// Missing credentials
// ---------------------------------------------------------------------------

describe("missing credentials", () => {
	test("danbooru: requests sent without login/api_key when credential absent", async () => {
		const urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				urls.push(url)
				return []
			},
		})

		await collect(booru_module.fetch(ctx, DANBOORU_INPUT, undefined))
		expect(urls[0]).not.toContain("api_key")
		expect(urls[0]).not.toContain("login")
	})

	test("gelbooru: requests sent without user_id/api_key when credential absent", async () => {
		const urls: string[] = []
		const ctx = make_stub_ctx({
			http_get_json: async (url) => {
				urls.push(url)
				return { post: [] }
			},
		})

		await collect(booru_module.fetch(ctx, GELBOORU_INPUT, undefined))
		expect(urls[0]).not.toContain("api_key")
		expect(urls[0]).not.toContain("user_id")
	})
})

// ---------------------------------------------------------------------------
// Registry interaction
// ---------------------------------------------------------------------------

describe("registry interaction", () => {
	test("register_sources includes booru after registration", () => {
		// Clean up any existing entries first
		for (const key of Object.keys(sources)) {
			delete sources[key]
		}

		register_sources()
		const entry = get_source("booru")
		expect(entry).toBeDefined()
		expect(entry?.slug).toBe("booru")

		// Clean up
		for (const key of Object.keys(sources)) {
			delete sources[key]
		}
	})

	test("_registry.lookup('booru') returns the entry post-bootstrap", () => {
		for (const key of Object.keys(sources)) {
			delete sources[key]
		}

		register_sources()
		expect(sources["booru"]).toBeDefined()
		expect(sources["booru"]?.display_name).toBe("Booru")

		// Clean up
		for (const key of Object.keys(sources)) {
			delete sources[key]
		}
	})
})
