import { z } from "zod"
import { SubscriptionSchema } from "./Subscription"

export const UpdateSubscriptionRequestSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	input_params: z.record(z.string(), z.unknown()).optional(),
	cron: z.string().min(1).optional(),
	max_items_inspected: z.number().int().min(1).nullable().optional(),
})

export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionRequestSchema>

export const UpdateSubscriptionResponseSchema = SubscriptionSchema

export type UpdateSubscriptionResponse = z.infer<typeof UpdateSubscriptionResponseSchema>
