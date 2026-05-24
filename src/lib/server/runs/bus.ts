/**
 * In-process event bus for run_history updates.
 *
 * The ingest pipeline imports `emit_update` after every significant write to
 * `run_history`. SSE handlers import `subscribe` to forward events to clients.
 */
import { EventEmitter } from "node:events"
import type { RunHistoryRow } from "$lib/server/db/schema"

const emitter = new EventEmitter()

// Increase the default listener limit — a busy server may have many SSE
// clients concurrently subscribed.
emitter.setMaxListeners(500)

const RUN_UPDATE_EVENT = "run.update"

/** Emit a run update event to all current SSE subscribers. */
export function emit_update(run: RunHistoryRow): void {
	emitter.emit(RUN_UPDATE_EVENT, run)
}

/**
 * Subscribe to run update events.
 *
 * @returns An unsubscribe function — call it to stop receiving events.
 */
export function subscribe(listener: (run: RunHistoryRow) => void): () => void {
	emitter.on(RUN_UPDATE_EVENT, listener)
	return () => {
		emitter.off(RUN_UPDATE_EVENT, listener)
	}
}
