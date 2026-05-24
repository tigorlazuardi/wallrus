import { z } from "zod"

export const ListDevicesRequestSchema = z.object({
	next: z.uuid().optional(),
	prev: z.uuid().optional(),
	offset: z.int().min(0).default(0),
	limit: z.int().min(1).max(100).default(20),
})

export type ListDevicesRequest = z.infer<typeof ListDevicesRequestSchema>

export const ListDevicesResponseSchema = z.object({
	items: z.array(z.object()),
	// ...
})

export type ListDevicesResponse = z.infer<typeof ListDevicesResponseSchema>
