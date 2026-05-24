import { z } from "zod"
import { DeviceSchema } from "./Device"

export const ToggleDeviceRequestSchema = z.object({
	id: z.string().uuid(),
	enabled: z.boolean(),
})

export type ToggleDeviceRequest = z.infer<typeof ToggleDeviceRequestSchema>

export const ToggleDeviceResponseSchema = DeviceSchema

export type ToggleDeviceResponse = z.infer<typeof ToggleDeviceResponseSchema>
