import { z } from "zod"
import { DeviceSchema } from "./Device"

export const ListDevicesRequestSchema = z.object({
	/** Forward cursor (base64url-encoded JSON { created_at, id }). `next` wins over `prev`. */
	next: z.string().optional(),
	/** Backward cursor (base64url-encoded JSON { created_at, id }). */
	prev: z.string().optional(),
	/** Additional rows to skip past the cursor anchor. Default 0. */
	offset: z.number().int().min(0).default(0),
	/** Page size, clamped to [1, 200]. Default 50. */
	limit: z.number().int().min(1).max(200).default(50),
	/** Filter to only enabled or only disabled devices. */
	enabled: z.boolean().optional(),
})

export type ListDevicesRequest = z.infer<typeof ListDevicesRequestSchema>

export const ListDevicesResponseSchema = z.object({
	items: z.array(DeviceSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListDevicesResponse = z.infer<typeof ListDevicesResponseSchema>
