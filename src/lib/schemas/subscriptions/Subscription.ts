/**
 * Subscription DTO schema — the shape returned by all subscription service operations.
 *
 * Timestamps are ms-since-epoch integers at the service layer; routes
 * may convert to ISO at the API boundary if needed.
 */
import { z } from "zod"

export const SubscriptionSchema = z.object({
	id: z.string().uuid(),
	source_slug: z.string(),
	name: z.string(),
	input_params: z.record(z.string(), z.unknown()),
	cron: z.string(),
	enabled: z.boolean(),
	max_items_inspected: z.number().int().nullable(),
	created_at: z.number().int(),
	deleted_at: z.number().int().nullable(),
})

export type Subscription = z.infer<typeof SubscriptionSchema>
