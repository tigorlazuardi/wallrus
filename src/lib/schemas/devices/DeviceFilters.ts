/**
 * Zod schema describing the filter criteria stored per device.
 *
 * Mirrors `DeviceFilterCriteria` in `src/lib/server/db/schema.ts`.
 * All fields are optional except `nsfw` which defaults to "all".
 *
 * Reused by:
 *   - 006-service-images (image filtering)
 *   - 009-ingest-fanout (fan-out evaluation)
 */
import { z } from "zod"

export const DeviceFiltersSchema = z
	.object({
		min_width: z.number().int().positive().optional(),
		max_width: z.number().int().positive().optional(),
		min_height: z.number().int().positive().optional(),
		max_height: z.number().int().positive().optional(),
		aspect_ratio: z
			.object({
				target: z.number().positive(),
				tolerance: z.number().min(0),
			})
			.optional(),
		min_bytes: z.number().int().nonnegative().optional(),
		max_bytes: z.number().int().positive().optional(),
		formats: z.array(z.enum(["jpg", "png", "webp", "avif"])).optional(),
		tags_include: z.array(z.string()).optional(),
		tags_exclude: z.array(z.string()).optional(),
		nsfw: z.enum(["all", "sfw_only", "nsfw_only"]).default("all"),
	})
	.strict()

export type DeviceFilters = z.infer<typeof DeviceFiltersSchema>
