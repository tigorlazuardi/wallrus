/**
 * Run DTO schema — the shape returned by all run_history service operations.
 *
 * Timestamps are ms-since-epoch integers at the service layer.
 */
import { z } from "zod"

export const RunSchema = z.object({
	id: z.string().uuid(),
	subscription_id: z.string().uuid(),
	started_at: z.number().int(),
	ended_at: z.number().int().nullable(),
	/** Computed: ended_at - started_at in ms. NULL while running. */
	duration_ms: z.number().int().nullable(),
	status: z.enum(["running", "success", "failed"]),
	error: z.string().nullable(),
	stop_reason: z
		.enum(["max_items_inspected", "source_exhausted", "error", "daemon_crash"])
		.nullable(),
	input_params_snapshot: z.record(z.string(), z.unknown()),
	items_seen: z.number().int(),
	items_new: z.number().int(),
	items_failed_download: z.number().int(),
	items_skipped_no_device: z.number().int(),
	/** Per-device add counts: { [device_id]: count } */
	device_adds: z.record(z.string(), z.number().int()),
})

export type Run = z.infer<typeof RunSchema>
