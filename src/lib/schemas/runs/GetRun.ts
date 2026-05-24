import { z } from "zod"
import { RunSchema } from "./Run"

export const GetRunRequestSchema = z
	.object({
		id: z.string().uuid(),
	})
	.strict()

export type GetRunRequest = z.infer<typeof GetRunRequestSchema>

export const GetRunResponseSchema = RunSchema

export type GetRunResponse = z.infer<typeof GetRunResponseSchema>
