import { z } from "zod"
import { ImageSchema } from "./Image"
import { NsfwFilterSchema } from "./ListImages"

export const ListDeviceImagesRequestSchema = z
	.object({
		/** The device ID to list images for. */
		device_id: z.string().uuid(),
		/** Forward cursor. */
		next: z.string().optional(),
		/** Backward cursor. */
		prev: z.string().optional(),
		/** Additional rows to skip. Default 0. */
		offset: z.number().int().min(0).default(0),
		/** Page size, clamped to [1, 200]. Default 50. */
		limit: z.number().int().min(1).max(200).default(50),
		/** Filter by source slug. */
		source_slug: z.string().optional(),
		/** Filter by favorite status. */
		favorited: z.boolean().optional(),
		/** NSFW filter. */
		nsfw: NsfwFilterSchema.optional(),
		/** Include soft-deleted images. Default false. */
		include_deleted: z.boolean().optional(),
		/** Include blacklisted images. Default false. */
		include_blacklisted: z.boolean().optional(),
		/** Full-text search string. */
		search: z.string().optional(),
	})
	.strict()

export type ListDeviceImagesRequest = z.infer<typeof ListDeviceImagesRequestSchema>

export const ListDeviceImagesResponseSchema = z.object({
	items: z.array(ImageSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListDeviceImagesResponse = z.infer<typeof ListDeviceImagesResponseSchema>
