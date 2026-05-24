import { z } from "zod"
import { ImageSchema } from "./Image"

export const SoftDeleteImageRequestSchema = z
	.object({
		id: z.string().uuid(),
	})
	.strict()

export type SoftDeleteImageRequest = z.infer<typeof SoftDeleteImageRequestSchema>

export const SoftDeleteImageResponseSchema = ImageSchema

export type SoftDeleteImageResponse = z.infer<typeof SoftDeleteImageResponseSchema>
