import { z } from "zod"

export const DeleteSubscriptionRequestSchema = z.object({
	id: z.string().uuid(),
})

export type DeleteSubscriptionRequest = z.infer<typeof DeleteSubscriptionRequestSchema>

export const DeleteSubscriptionResponseSchema = z.object({
	id: z.string().uuid(),
	deleted_at: z.number().int(),
})

export type DeleteSubscriptionResponse = z.infer<typeof DeleteSubscriptionResponseSchema>
