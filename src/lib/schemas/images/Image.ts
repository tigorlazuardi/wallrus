import { z } from "zod"

/**
 * Image DTO — returned by all image service operations.
 *
 * - `tags_source`: source-supplied tags (stored as JSON on the images row).
 * - `tags_user`: user-added tags (joined from image_user_tags junction).
 * - `favorited`: whether this image is in the favorites table (derived via LEFT JOIN).
 */
export const ImageSchema = z.object({
	id: z.string(),
	sha256: z.string(),
	source_slug: z.string(),
	source_id: z.string(),
	source_url: z.string(),
	image_url: z.string(),
	title: z.string(),
	filename: z.string(),
	width: z.number().int(),
	height: z.number().int(),
	file_size: z.number().int(),
	format: z.enum(["jpg", "png", "webp", "avif"]),
	nsfw: z.enum(["sfw", "nsfw", "unknown"]),
	tags_source: z.array(z.string()),
	tags_user: z.array(z.string()),
	search_text: z.string().nullable(),
	created_at_source: z.number().int().nullable(),
	ingested_at: z.number().int(),
	deleted_at: z.number().int().nullable(),
	blacklisted_at: z.number().int().nullable(),
	aspect_ratio: z.number().nullable(),
	favorited: z.boolean(),
})

export type Image = z.infer<typeof ImageSchema>
