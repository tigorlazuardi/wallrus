import { z } from "zod"
import { ImageSchema } from "./Image"

export const GetImageRequestSchema = z
	.object({
		id: z.string().uuid(),
		/** If true, return the image even if it is soft-deleted. Default false. */
		include_deleted: z.boolean().optional(),
	})
	.strict()

export type GetImageRequest = z.infer<typeof GetImageRequestSchema>

export const GetImageResponseSchema = ImageSchema

export type GetImageResponse = z.infer<typeof GetImageResponseSchema>
