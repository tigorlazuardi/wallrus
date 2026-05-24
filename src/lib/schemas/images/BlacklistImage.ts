import { z } from "zod"
import { ImageSchema } from "./Image"

export const BlacklistImageRequestSchema = z
	.object({
		id: z.string().uuid(),
	})
	.strict()

export type BlacklistImageRequest = z.infer<typeof BlacklistImageRequestSchema>

export const BlacklistImageResponseSchema = ImageSchema

export type BlacklistImageResponse = z.infer<typeof BlacklistImageResponseSchema>
