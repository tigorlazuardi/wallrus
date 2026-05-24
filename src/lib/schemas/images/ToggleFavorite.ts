import { z } from "zod"
import { ImageSchema } from "./Image"

export const ToggleFavoriteRequestSchema = z
	.object({
		image_id: z.string().uuid(),
		favorited: z.boolean(),
	})
	.strict()

export type ToggleFavoriteRequest = z.infer<typeof ToggleFavoriteRequestSchema>

export const ToggleFavoriteResponseSchema = ImageSchema

export type ToggleFavoriteResponse = z.infer<typeof ToggleFavoriteResponseSchema>
