import { z } from "zod"
import { DeviceSchema } from "./Device"

/** Look up a device by id (UUID) or by slug (kebab string). */
export const GetDeviceRequestSchema = z.union([
	z.object({ id: z.string().uuid() }),
	z.object({ slug: z.string().min(1).max(64) }),
])

export type GetDeviceRequest = z.infer<typeof GetDeviceRequestSchema>

export const GetDeviceResponseSchema = DeviceSchema

export type GetDeviceResponse = z.infer<typeof GetDeviceResponseSchema>
