import { z } from "zod"
import { ImageSchema } from "./Image"

export const RestoreImageRequestSchema = z
	.object({
		id: z.string().uuid(),
	})
	.strict()

export type RestoreImageRequest = z.infer<typeof RestoreImageRequestSchema>

export const RestoreImageResponseSchema = ImageSchema

export type RestoreImageResponse = z.infer<typeof RestoreImageResponseSchema>
