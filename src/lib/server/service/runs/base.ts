/**
 * RunServiceBase — root class for all run operation mixins.
 *
 * Provides `to_run_dto` converter and re-exports shared types.
 */
import { run_history } from "$lib/server/db/schema"
import type { Run } from "$lib/schemas/runs/Run"
import { Base, type Constructor, type Dependencies } from "../base"

export { Base, type Constructor, type Dependencies }

/** Convert a raw Drizzle `run_history` row to a Run DTO. */
export function to_run_dto(row: typeof run_history.$inferSelect): Run {
	return {
		id: row.id,
		subscription_id: row.subscription_id,
		started_at: row.started_at,
		ended_at: row.ended_at ?? null,
		duration_ms: row.duration_ms ?? null,
		status: row.status as "running" | "success" | "failed",
		error: row.error ?? null,
		stop_reason: row.stop_reason as
			| "max_items_inspected"
			| "source_exhausted"
			| "error"
			| "daemon_crash"
			| null,
		input_params_snapshot: row.input_params_snapshot,
		items_seen: row.items_seen,
		items_new: row.items_new,
		items_failed_download: row.items_failed_download,
		items_skipped_no_device: row.items_skipped_no_device,
		device_adds: row.device_adds,
	}
}
