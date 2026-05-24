import { z } from "zod"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { register } from "./_registry"
import type { SourceContext, SourceItem, SourceModule } from "./_types"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const RedditInputSchema = z
	.object({
		subreddit: z.string().regex(/^[a-zA-Z0-9_]{2,21}$/),
		sort: z.enum(["hot", "new", "top", "rising"]).default("hot"),
		time: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
		limit_per_page: z.number().int().min(1).max(100).default(100),
	})
	.strict()

export const RedditCredentialSchema = z
	.object({
		client_id: z.string().min(1),
		client_secret: z.string().min(1),
		user_agent: z.string().min(1),
	})
	.strict()

export type RedditInput = z.infer<typeof RedditInputSchema>
export type RedditCredential = z.infer<typeof RedditCredentialSchema>

// ---------------------------------------------------------------------------
// Reddit API response shapes (minimal — only the fields we use)
// ---------------------------------------------------------------------------

const TokenResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.string(),
	expires_in: z.number(),
})

interface RedditPost {
	id: string
	name: string
	title: string
	subreddit: string
	permalink: string
	url: string
	post_hint?: string
	is_gallery?: boolean
	over_18: boolean
	created_utc: number
	media_metadata?: Record<
		string,
		{
			status: string
			e?: string
			m?: string
			s?: { u: string; x?: number; y?: number }
			id?: string
		}
	>
	gallery_data?: {
		items: Array<{ media_id: string; id: number }>
	}
}

interface RedditListing {
	kind: string
	data: {
		after: string | null
		children: Array<{ kind: string; data: RedditPost }>
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif)(\?.*)?$/i

function is_image_url(url: string): boolean {
	return IMAGE_EXT_RE.test(url)
}

function is_image_post(post: RedditPost): boolean {
	return post.post_hint === "image" || is_image_url(post.url)
}

function is_gallery_post(post: RedditPost): boolean {
	return !!(post.is_gallery && post.media_metadata && post.gallery_data)
}

function decode_reddit_url(u: string): string {
	// Reddit HTML-encodes ampersands in preview URLs; decode &amp; → &
	return u.replace(/&amp;/g, "&")
}

function map_nsfw(over_18: boolean): "sfw" | "nsfw" {
	return over_18 ? "nsfw" : "sfw"
}

function map_single_post(post: RedditPost): SourceItem {
	return {
		source_id: post.id,
		title: post.title,
		source_url: `https://www.reddit.com${post.permalink}`,
		image_url: decode_reddit_url(post.url),
		filename: post.id,
		tags: [],
		nsfw: map_nsfw(post.over_18),
		created_at_source: new Date(post.created_utc * 1000).toISOString(),
		search_text: `${post.title} ${post.subreddit}`,
	}
}

function map_gallery_items(post: RedditPost): SourceItem[] {
	if (!post.gallery_data || !post.media_metadata) return []

	const items: SourceItem[] = []
	for (const gallery_item of post.gallery_data.items) {
		const media_id = gallery_item.media_id
		const meta = post.media_metadata[media_id]
		if (!meta || meta.status !== "valid" || !meta.s?.u) continue

		items.push({
			source_id: `${post.id}_${media_id}`,
			title: post.title,
			source_url: `https://www.reddit.com${post.permalink}`,
			image_url: decode_reddit_url(meta.s.u),
			filename: `${post.id}_${media_id}`,
			width: meta.s.x,
			height: meta.s.y,
			tags: [],
			nsfw: map_nsfw(post.over_18),
			created_at_source: new Date(post.created_utc * 1000).toISOString(),
			search_text: `${post.title} ${post.subreddit}`,
		})
	}
	return items
}

// ---------------------------------------------------------------------------
// Token fetch
// ---------------------------------------------------------------------------

async function fetch_token(ctx: SourceContext, credential: RedditCredential): Promise<string> {
	const { client_id, client_secret, user_agent } = credential
	const basic = btoa(`${client_id}:${client_secret}`)

	const raw = await ctx.http_post_form(
		"https://www.reddit.com/api/v1/access_token",
		{ grant_type: "client_credentials" },
		{
			headers: {
				Authorization: `Basic ${basic}`,
				"User-Agent": user_agent,
			},
		},
	)

	const parsed = TokenResponseSchema.safeParse(raw)
	if (!parsed.success) {
		throw AppError.fail("source.reddit.token_invalid", {
			fields: { issues: parsed.error.issues },
		})
	}
	return parsed.data.access_token
}

// ---------------------------------------------------------------------------
// Source module
// ---------------------------------------------------------------------------

const reddit_module: SourceModule<RedditInput, RedditCredential> = {
	slug: "reddit",
	display_name: "Reddit",
	params_schema: RedditInputSchema,
	credential: {
		schema: RedditCredentialSchema,
		description: "OAuth client_id + secret + User-Agent",
	},

	async *fetch(
		ctx: SourceContext,
		input: RedditInput,
		credential?: RedditCredential,
	): AsyncGenerator<SourceItem, void, void> {
		if (!credential) {
			throw AppError.fail("source.credentials_missing", {
				fields: { slug: "reddit" },
			})
		}

		ctx.log("info", "reddit: fetching OAuth token", { subreddit: input.subreddit })
		const token = await fetch_token(ctx, credential)

		const { subreddit, sort, time, limit_per_page } = input
		let after: string | null = null
		let first_page = true

		while (!ctx.abort.aborted) {
			const params = new URLSearchParams({
				limit: String(limit_per_page),
			})
			if (sort === "top" && time) {
				params.set("t", time)
			}
			if (!first_page && after) {
				params.set("after", after)
			}

			const url = `https://oauth.reddit.com/r/${subreddit}/${sort}.json?${params.toString()}`
			ctx.log("debug", "reddit: fetching listing page", { url, after })

			const raw = await ctx.http_get_json(url, {
				headers: {
					Authorization: `Bearer ${token}`,
					"User-Agent": credential.user_agent,
				},
			})

			// TODO: rate-limit honour, needs http_get_with_headers — see
			// plans/007-source-reddit/.builder-notes.md §Rate-limit headers deferred

			const listing = raw as RedditListing
			const children = listing?.data?.children ?? []

			for (const child of children) {
				if (ctx.abort.aborted) break
				const post = child.data

				if (is_gallery_post(post)) {
					const gallery_items = map_gallery_items(post)
					ctx.log("debug", "reddit: expanding gallery", {
						post_id: post.id,
						count: gallery_items.length,
					})
					for (const item of gallery_items) {
						yield item
					}
				} else if (is_image_post(post)) {
					ctx.log("debug", "reddit: yielding image post", { post_id: post.id })
					yield map_single_post(post)
				} else {
					ctx.log("debug", "reddit: skipping non-image post", {
						post_id: post.id,
						post_hint: post.post_hint,
					})
				}
			}

			after = listing?.data?.after ?? null
			first_page = false

			if (!after) {
				ctx.log("info", "reddit: pagination exhausted", { subreddit })
				break
			}
		}
	},
}

/**
 * Register the Reddit source module in the global registry.
 * Called by `register_sources()` in `_registry.ts`.
 */
export function register_reddit(): void {
	// Cast to the untyped SourceModule shape that the registry stores.
	// The generic parameters are erased at registry level; runtime callers
	// validate params + credentials via the module's own Zod schemas.
	register(reddit_module as SourceModule)
}

export default reddit_module
