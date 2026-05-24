import { z } from "zod"
import { DeviceSchema } from "$lib/schemas/devices/Device"

export const ListSubscriptionDevicesRequestSchema = z.object({
	subscription_id: z.string().uuid(),
	next: z.string().optional(),
	prev: z.string().optional(),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(200).default(50),
})

export type ListSubscriptionDevicesRequest = z.infer<typeof ListSubscriptionDevicesRequestSchema>

export const ListSubscriptionDevicesResponseSchema = z.object({
	items: z.array(DeviceSchema),
	total: z.number().int(),
	next_cursor: z.string().optional(),
	prev_cursor: z.string().optional(),
})

export type ListSubscriptionDevicesResponse = z.infer<typeof ListSubscriptionDevicesResponseSchema>
