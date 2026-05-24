import { z } from "zod"
import { SubscriptionSchema } from "./Subscription"

export const ListSubscriptionsRequestSchema = z.object({
	next: z.string().optional(),
	prev: z.string().optional(),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(200).default(50),
	enabled: z.boolean().optional(),
	source_slug: z.string().optional(),
	include_deleted: z.boolean().optional().default(false),
})

export type ListSubscriptionsRequest = z.infer<typeof ListSubscriptionsRequestSchema>

export const ListSubscriptionsResponseSchema = z.object({
	items: z.array(SubscriptionSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListSubscriptionsResponse = z.infer<typeof ListSubscriptionsResponseSchema>
