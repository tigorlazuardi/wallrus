import { z } from "zod"

export const LinkDeviceRequestSchema = z.object({
	subscription_id: z.string().uuid(),
	device_id: z.string().uuid(),
})

export type LinkDeviceRequest = z.infer<typeof LinkDeviceRequestSchema>

export const LinkDeviceResponseSchema = z.object({
	subscription_id: z.string().uuid(),
	device_id: z.string().uuid(),
	created_at: z.number().int(),
})

export type LinkDeviceResponse = z.infer<typeof LinkDeviceResponseSchema>
