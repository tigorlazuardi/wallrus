import { z } from "zod"

export const RemoveTagRequestSchema = z
	.object({
		image_id: z.string().uuid(),
		/** Tag to remove; will be normalised (trim + lowercase) by the service. */
		tag: z.string().min(1).max(200),
	})
	.strict()

export type RemoveTagRequest = z.infer<typeof RemoveTagRequestSchema>

export const RemoveTagResponseSchema = z.object({
	success: z.boolean(),
})

export type RemoveTagResponse = z.infer<typeof RemoveTagResponseSchema>
