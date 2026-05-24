import { z } from "zod"
import { ImageSchema } from "./Image"

export const NsfwFilterSchema = z.enum(["all", "sfw_only", "nsfw_only"])
export type NsfwFilter = z.infer<typeof NsfwFilterSchema>

export const ListImagesRequestSchema = z
	.object({
		/** Forward cursor (base64url-encoded JSON { created_at, id }). `next` wins over `prev`. */
		next: z.string().optional(),
		/** Backward cursor (base64url-encoded JSON { created_at, id }). */
		prev: z.string().optional(),
		/** Additional rows to skip past the cursor anchor. Default 0. */
		offset: z.number().int().min(0).default(0),
		/** Page size, clamped to [1, 200]. Default 50. */
		limit: z.number().int().min(1).max(200).default(50),
		/** Filter by device ID (images that are in that device's dir). */
		device_id: z.string().uuid().optional(),
		/** Filter by source slug. */
		source_slug: z.string().optional(),
		/** Filter by favorite status. */
		favorited: z.boolean().optional(),
		/** NSFW filter. 'all' includes unknown. Default 'all'. */
		nsfw: NsfwFilterSchema.optional(),
		/** Include soft-deleted images. Default false. */
		include_deleted: z.boolean().optional(),
		/** Include blacklisted images. Default false. */
		include_blacklisted: z.boolean().optional(),
		/** Full-text search string (matched via FTS5). */
		search: z.string().optional(),
	})
	.strict()

export type ListImagesRequest = z.infer<typeof ListImagesRequestSchema>

export const ListImagesResponseSchema = z.object({
	items: z.array(ImageSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListImagesResponse = z.infer<typeof ListImagesResponseSchema>
