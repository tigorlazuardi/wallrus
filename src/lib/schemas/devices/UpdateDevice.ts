import { z } from "zod"
import { DeviceFiltersSchema } from "./DeviceFilters"
import { DeviceSchema } from "./Device"

export const UpdateDeviceRequestSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	native_width: z.number().int().positive().max(32768).optional().nullable(),
	native_height: z.number().int().positive().max(32768).optional().nullable(),
	filter_criteria: DeviceFiltersSchema.optional(),
})

export type UpdateDeviceRequest = z.infer<typeof UpdateDeviceRequestSchema>

export const UpdateDeviceResponseSchema = DeviceSchema

export type UpdateDeviceResponse = z.infer<typeof UpdateDeviceResponseSchema>
