import { z } from "zod"
import { SubscriptionSchema } from "./Subscription"

export const GetSubscriptionRequestSchema = z.object({
	id: z.string().uuid(),
})

export type GetSubscriptionRequest = z.infer<typeof GetSubscriptionRequestSchema>

export const GetSubscriptionResponseSchema = SubscriptionSchema

export type GetSubscriptionResponse = z.infer<typeof GetSubscriptionResponseSchema>
