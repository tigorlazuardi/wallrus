/**
 * Device DTO schema — the shape returned by all device service operations.
 *
 * Timestamps are ms-since-epoch integers at the service layer; routes
 * may convert to ISO at the API boundary if needed.
 */
import { z } from "zod"
import { DeviceFiltersSchema } from "./DeviceFilters"

export const DeviceSchema = z.object({
	id: z.string().uuid(),
	slug: z.string(),
	name: z.string(),
	enabled: z.boolean(),
	filter_criteria: DeviceFiltersSchema,
	native_width: z.number().int().positive().max(32768).optional().nullable(),
	native_height: z.number().int().positive().max(32768).optional().nullable(),
	created_at: z.number().int(),
})

export type Device = z.infer<typeof DeviceSchema>
