/**
 * In-process event bus for run_history updates.
 *
 * The ingest pipeline imports `emit_update` after every significant write to
 * `run_history`. SSE handlers import `subscribe` to forward events to clients.
 */
import { EventEmitter } from "node:events"
import type { RunHistoryRow } from "$lib/server/db/schema"

// Stored on `globalThis` so the same emitter is shared between the cli.ts module
// graph (scheduler/ingest call `emit_update`) and the bundled SvelteKit build
// graph (the SSE route `/api/v1/runs/stream` calls `subscribe`). Without this
// the two graphs hold separate emitters and run updates never reach SSE
// clients. Mirrors the globalThis pattern in `runtime.ts` / `_registry.ts`.
declare global {
	var __wallrus_runs_emitter__: EventEmitter | undefined
}

const emitter: EventEmitter = (globalThis.__wallrus_runs_emitter__ ??= new EventEmitter())

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
