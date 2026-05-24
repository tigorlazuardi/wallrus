import { z } from "zod"
import { RunSchema } from "./Run"

export const ListRunsRequestSchema = z
	.object({
		next: z.string().optional(),
		prev: z.string().optional(),
		offset: z.number().int().min(0).default(0),
		limit: z.number().int().min(1).max(200).default(50),
		subscription_id: z.string().uuid().optional(),
		status: z.enum(["running", "success", "failed"]).optional(),
		/** Filter: only runs started at or after this ms-epoch timestamp. */
		since: z.number().int().optional(),
		/** Filter: only runs started before this ms-epoch timestamp. */
		until: z.number().int().optional(),
	})
	.strict()

export type ListRunsRequest = z.infer<typeof ListRunsRequestSchema>

export const ListRunsResponseSchema = z.object({
	items: z.array(RunSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListRunsResponse = z.infer<typeof ListRunsResponseSchema>
