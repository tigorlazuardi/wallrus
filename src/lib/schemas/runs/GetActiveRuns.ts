import { z } from "zod"
import { RunSchema } from "./Run"

export const GetActiveRunsRequestSchema = z.object({}).strict()

export type GetActiveRunsRequest = z.infer<typeof GetActiveRunsRequestSchema>

export const GetActiveRunsResponseSchema = z.object({
	items: z.array(RunSchema),
	total: z.number().int(),
})

export type GetActiveRunsResponse = z.infer<typeof GetActiveRunsResponseSchema>
