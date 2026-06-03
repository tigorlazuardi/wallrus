import { z } from "zod"

export const ReleaseLatestSchema = z.object({
	version: z.string().min(1),
	sha256: z.string().min(64).max(64),
	url: z.string().url(),
	mandatory: z.boolean(),
})

export type ReleaseLatest = z.infer<typeof ReleaseLatestSchema>

/**
 * Looser schema for the "not configured" case where env vars are absent.
 * The route returns this shape when no release has been published yet.
 */
export const ReleaseLatestUnconfiguredSchema = z.object({
	version: z.string(),
	sha256: z.string(),
	url: z.string(),
	mandatory: z.boolean(),
})

export type ReleaseLatestUnconfigured = z.infer<typeof ReleaseLatestUnconfiguredSchema>
