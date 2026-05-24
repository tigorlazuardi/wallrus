import { z } from "zod"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { register } from "./_registry"
import type { SourceContext, SourceItem, SourceModule } from "./_types"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const BooruInputSchema = z
	.object({
		variant: z.enum(["danbooru", "gelbooru"]),
		host: z.string().url(),
		tags: z.array(z.string()).min(0).max(10),
		limit_per_page: z.number().int().min(1).max(100).default(50),
		rating: z.enum(["s", "q", "e", "any"]).default("any"),
	})
	.strict()

// Credential schema: flat object with optional login/user_id, required api_key.
// A refine ensures at least one of login (danbooru) or user_id (gelbooru) is
// present. Flat shape chosen over discriminated union to keep the type simple —
// variant is already in the input params.
export const BooruCredentialSchema = z
	.object({
		login: z.string().min(1).optional(),
		user_id: z.string().min(1).optional(),
		api_key: z.string().min(1),
	})
	.refine((c) => c.login !== undefined || c.user_id !== undefined, {
		message: "Either login (danbooru) or user_id (gelbooru) must be provided",
	})

export type BooruInput = z.infer<typeof BooruInputSchema>
export type BooruCredential = z.infer<typeof BooruCredentialSchema>

// ---------------------------------------------------------------------------
// Booru API response shapes (minimal — only the fields we use)
// ---------------------------------------------------------------------------

interface DanbooruPost {
	id: number
	created_at: string
	rating: string
	file_url?: string | null
	file_size?: number | null
	image_width?: number | null
	image_height?: number | null
	tag_string_general?: string
	tag_string_character?: string
	tag_string_copyright?: string
	tag_string_artist?: string
}

interface GelbooruPost {
	id: number
	created_at: string
	rating: string
	file_url?: string | null
	width?: number | null
	height?: number | null
	image?: string | null
	tags?: string
}

interface GelbooruResponse {
	post?: GelbooruPost[]
	posts?: GelbooruPost[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILE_EXT_RE = /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i

function extract_format(file_url: string): "jpg" | "png" | "webp" | "avif" | "gif" | undefined {
	const match = FILE_EXT_RE.exec(file_url)
	if (!match) return undefined
	const ext = match[1]!.toLowerCase()
	if (ext === "jpeg") return "jpg"
	if (ext === "jpg" || ext === "png" || ext === "webp" || ext === "avif" || ext === "gif")
		return ext
	return undefined
}

function map_nsfw(rating: string): "sfw" | "nsfw" {
	// s = safe, g = general (newer danbooru) → sfw
	// q = questionable, e = explicit → nsfw
	if (rating === "s" || rating === "g") return "sfw"
	return "nsfw"
}

function normalize_tags(raw: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const tag of raw) {
		const lower = tag.toLowerCase().trim()
		if (lower && !seen.has(lower)) {
			seen.add(lower)
			result.push(lower)
		}
	}
	return result
}

function danbooru_tags(post: DanbooruPost): string[] {
	const raw = [
		...(post.tag_string_general?.split(/\s+/) ?? []),
		...(post.tag_string_character?.split(/\s+/) ?? []),
		...(post.tag_string_copyright?.split(/\s+/) ?? []),
		...(post.tag_string_artist?.split(/\s+/) ?? []),
	].filter(Boolean)
	return normalize_tags(raw)
}

function gelbooru_tags(post: GelbooruPost): string[] {
	const raw = (post.tags ?? "").split(/\s+/).filter(Boolean)
	return normalize_tags(raw)
}

function build_danbooru_url(
	host: string,
	tags_param: string,
	limit: number,
	page: number,
	credential?: BooruCredential,
): string {
	const params = new URLSearchParams({
		limit: String(limit),
		page: String(page),
		tags: tags_param,
	})
	if (credential?.login) {
		params.set("login", credential.login)
		params.set("api_key", credential.api_key)
	}
	return `${host}/posts.json?${params.toString()}`
}

function build_gelbooru_url(
	host: string,
	tags_param: string,
	limit: number,
	pid: number,
	credential?: BooruCredential,
): string {
	const params = new URLSearchParams({
		page: "dapi",
		s: "post",
		q: "index",
		json: "1",
		limit: String(limit),
		pid: String(pid),
		tags: tags_param,
	})
	if (credential?.user_id) {
		params.set("user_id", credential.user_id)
		params.set("api_key", credential.api_key)
	}
	return `${host}/index.php?${params.toString()}`
}

function build_tags_param(input: BooruInput): string {
	const parts = [...input.tags]
	if (input.rating !== "any") {
		parts.push(`rating:${input.rating}`)
	}
	return parts.join("+")
}

// ---------------------------------------------------------------------------
// Source module
// ---------------------------------------------------------------------------

const booru_module: SourceModule<BooruInput, BooruCredential> = {
	slug: "booru",
	display_name: "Booru",
	params_schema: BooruInputSchema,
	credential: {
		schema: BooruCredentialSchema,
		description: "Danbooru login+api_key or Gelbooru user_id+api_key",
	},

	async *fetch(
		ctx: SourceContext,
		input: BooruInput,
		credential?: BooruCredential,
	): AsyncGenerator<SourceItem, void, void> {
		const { variant, host, limit_per_page } = input
		const tags_param = build_tags_param(input)

		ctx.log("info", "booru: starting fetch", { variant, host, tags_param })

		let page = variant === "danbooru" ? 1 : 0

		while (!ctx.abort.aborted) {
			const url =
				variant === "danbooru"
					? build_danbooru_url(host, tags_param, limit_per_page, page, credential)
					: build_gelbooru_url(host, tags_param, limit_per_page, page, credential)

			ctx.log("debug", "booru: fetching page", { variant, url, page })

			let raw: unknown
			try {
				raw = await ctx.http_get_json(url)
			} catch (err) {
				throw AppError.wrap(err, {
					message: `source.booru.fetch_failed`,
					fields: { variant, url },
				})
			}

			let posts: unknown[]

			if (variant === "danbooru") {
				if (!Array.isArray(raw)) {
					ctx.log("warn", "booru: danbooru response is not an array, stopping", {
						variant,
					})
					break
				}
				posts = raw
			} else {
				// Gelbooru wraps in { post: [...] } (modern) or { posts: [...] } (legacy)
				const gel = raw as GelbooruResponse
				posts = gel.post ?? gel.posts ?? []
			}

			if (posts.length === 0) {
				ctx.log("info", "booru: empty page, pagination exhausted", { variant, page })
				break
			}

			for (const raw_post of posts) {
				if (ctx.abort.aborted) break

				if (variant === "danbooru") {
					const post = raw_post as DanbooruPost

					if (!post.file_url) {
						ctx.log("debug", "booru: skipping post with null file_url", { id: post.id })
						continue
					}

					const format = extract_format(post.file_url)
					if (!format) {
						ctx.log("debug", "booru: skipping post with unrecognized extension", {
							id: post.id,
							file_url: post.file_url,
						})
						continue
					}
					if (format === "gif") {
						ctx.log("debug", "booru: skipping gif post", { id: post.id })
						continue
					}

					const tags = danbooru_tags(post)
					const source_id = String(post.id)
					const source_url = `${host}/posts/${post.id}`

					const item: SourceItem = {
						source_id,
						title: "",
						source_url,
						image_url: post.file_url,
						filename: source_id,
						nsfw: map_nsfw(post.rating),
						tags,
						format,
						created_at_source: post.created_at,
						search_text: tags.slice(0, 20).join(" "),
					}
					if (post.image_width != null) item.width = post.image_width
					if (post.image_height != null) item.height = post.image_height
					if (post.file_size != null) item.file_size = post.file_size

					ctx.log("debug", "booru: yielding danbooru item", { source_id })
					yield item
				} else {
					const post = raw_post as GelbooruPost

					if (!post.file_url) {
						ctx.log("debug", "booru: skipping gelbooru post with null file_url", {
							id: post.id,
						})
						continue
					}

					const format = extract_format(post.file_url)
					if (!format) {
						ctx.log(
							"debug",
							"booru: skipping gelbooru post with unrecognized extension",
							{
								id: post.id,
								file_url: post.file_url,
							},
						)
						continue
					}
					if (format === "gif") {
						ctx.log("debug", "booru: skipping gelbooru gif post", { id: post.id })
						continue
					}

					const tags = gelbooru_tags(post)
					const source_id = String(post.id)
					const source_url = `${host}/index.php?page=post&s=view&id=${post.id}`

					const item: SourceItem = {
						source_id,
						title: "",
						source_url,
						image_url: post.file_url,
						filename: source_id,
						nsfw: map_nsfw(post.rating),
						tags,
						format,
						created_at_source: post.created_at,
						search_text: tags.slice(0, 20).join(" "),
					}
					if (post.width != null) item.width = post.width
					if (post.height != null) item.height = post.height

					ctx.log("debug", "booru: yielding gelbooru item", { source_id })
					yield item
				}
			}

			page++
		}
	},
}

/**
 * Register the Booru source module in the global registry.
 * Called by `register_sources()` in `_registry.ts`.
 */
export function register_booru(): void {
	register(booru_module as SourceModule)
}

export default booru_module
