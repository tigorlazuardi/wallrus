import { z } from "zod"
import { DeviceFiltersSchema } from "./DeviceFilters"
import { DeviceSchema } from "./Device"

export const CreateDeviceRequestSchema = z.object({
	/**
	 * URL-safe slug: lowercase, kebab-case, max 64 chars.
	 * Must match `[a-z0-9-]{1,64}`.
	 */
	slug: z
		.string()
		.regex(
			/^[a-z0-9-]{1,64}$/,
			"Slug must be lowercase alphanumeric with hyphens, max 64 chars",
		)
		.transform((s) => s.toLowerCase()),
	name: z.string().min(1).max(255),
	filter_criteria: z
		.preprocess((v) => (v === undefined ? {} : v), DeviceFiltersSchema)
		.default({ nsfw: "all" }),
})

export type CreateDeviceRequest = z.infer<typeof CreateDeviceRequestSchema>

export const CreateDeviceResponseSchema = DeviceSchema

export type CreateDeviceResponse = z.infer<typeof CreateDeviceResponseSchema>
