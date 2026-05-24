/**
 * update_run — perform a DB UPDATE on run_history and emit the bus event.
 *
 * Every significant write to an existing run_history row should go through
 * this helper so SSE clients receive the update automatically.
 */
import { eq } from "drizzle-orm"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { Runtime } from "$lib/server/bootstrap"
import { run_history, type RunHistoryRow } from "$lib/server/db/schema"
import { emit_update } from "./bus"

/**
 * Update a run_history row and emit a `run.update` bus event.
 *
 * Throws `AppError` with `status: 404` if no row exists for `run_id`.
 */
export async function update_run(
	runtime: Runtime,
	run_id: string,
	patch: Partial<RunHistoryRow>,
): Promise<RunHistoryRow> {
	const { db } = runtime

	const rows = await withQueryName("runs.update_run", () =>
		db.update(run_history).set(patch).where(eq(run_history.id, run_id)).returning(),
	)

	const updated = rows[0]
	if (!updated) {
		throw new AppError({
			message: `run not found: ${run_id}`,
			publicMessage: "Run not found.",
			status: 404,
			fields: { run_id },
		})
	}

	emit_update(updated)
	return updated
}
