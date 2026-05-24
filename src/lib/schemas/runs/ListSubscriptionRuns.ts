import { z } from "zod"
import { ListRunsRequestSchema, ListRunsResponseSchema } from "./ListRuns"

/** Same as ListRuns but subscription_id is required and pinned by the service. */
export const ListSubscriptionRunsRequestSchema = ListRunsRequestSchema.omit({
	subscription_id: true,
}).extend({
	subscription_id: z.string().uuid(),
})

export type ListSubscriptionRunsRequest = z.infer<typeof ListSubscriptionRunsRequestSchema>

export const ListSubscriptionRunsResponseSchema = ListRunsResponseSchema

export type ListSubscriptionRunsResponse = z.infer<typeof ListSubscriptionRunsResponseSchema>
