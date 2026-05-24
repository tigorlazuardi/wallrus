import { z } from "zod"
import { SubscriptionSchema } from "./Subscription"

export const ToggleSubscriptionRequestSchema = z.object({
	id: z.string().uuid(),
	enabled: z.boolean(),
})

export type ToggleSubscriptionRequest = z.infer<typeof ToggleSubscriptionRequestSchema>

export const ToggleSubscriptionResponseSchema = SubscriptionSchema

export type ToggleSubscriptionResponse = z.infer<typeof ToggleSubscriptionResponseSchema>
