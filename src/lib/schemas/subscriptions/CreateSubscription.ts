import { z } from "zod"
import { SubscriptionSchema } from "./Subscription"

export const CreateSubscriptionRequestSchema = z.object({
	source_slug: z.string().min(1),
	name: z.string().min(1).max(255),
	input_params: z.record(z.string(), z.unknown()).default({}),
	cron: z.string().min(1),
	max_items_inspected: z.number().int().min(1).optional(),
})

export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>

export const CreateSubscriptionResponseSchema = SubscriptionSchema

export type CreateSubscriptionResponse = z.infer<typeof CreateSubscriptionResponseSchema>
