import { z } from "zod"

export const AddTagRequestSchema = z
	.object({
		image_id: z.string().uuid(),
		/** Tag to add; will be normalised (trim + lowercase) by the service. */
		tag: z.string().min(1).max(200),
	})
	.strict()

export type AddTagRequest = z.infer<typeof AddTagRequestSchema>

export const AddTagResponseSchema = z.object({
	image_id: z.string(),
	tag: z.string(),
	created_at: z.number().int(),
})

export type AddTagResponse = z.infer<typeof AddTagResponseSchema>
