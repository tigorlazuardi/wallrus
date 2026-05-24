import { z } from "zod"

export const UnlinkDeviceRequestSchema = z.object({
	subscription_id: z.string().uuid(),
	device_id: z.string().uuid(),
})

export type UnlinkDeviceRequest = z.infer<typeof UnlinkDeviceRequestSchema>

export const UnlinkDeviceResponseSchema = z.object({
	subscription_id: z.string().uuid(),
	device_id: z.string().uuid(),
})

export type UnlinkDeviceResponse = z.infer<typeof UnlinkDeviceResponseSchema>
