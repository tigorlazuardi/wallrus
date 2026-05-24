import { describe, expect, test } from "bun:test"
import { emit_update, subscribe } from "./bus"
import type { RunHistoryRow } from "$lib/server/db/schema"

const STUB_RUN: RunHistoryRow = {
	id: "01900000-0000-7000-0000-000000000001",
	subscription_id: "01900000-0000-7000-0000-000000000002",
	started_at: 1_700_000_000_000,
	ended_at: null,
	duration_ms: null,
	status: "running",
	error: null,
	stop_reason: null,
	input_params_snapshot: {},
	items_seen: 0,
	items_new: 0,
	items_failed_download: 0,
	items_skipped_no_device: 0,
	device_adds: {},
}

describe("bus", () => {
	test("subscribe receives emitted events", () => {
		const received: RunHistoryRow[] = []
		const unsub = subscribe((run) => received.push(run))

		emit_update(STUB_RUN)

		unsub()

		expect(received).toHaveLength(1)
		expect(received[0]).toEqual(STUB_RUN)
	})

	test("unsubscribe stops receiving events", () => {
		const received: RunHistoryRow[] = []
		const unsub = subscribe((run) => received.push(run))

		emit_update(STUB_RUN)
		unsub()
		emit_update(STUB_RUN)

		expect(received).toHaveLength(1)
	})

	test("multiple subscribers each receive the event", () => {
		const a: RunHistoryRow[] = []
		const b: RunHistoryRow[] = []
		const unsubA = subscribe((r) => a.push(r))
		const unsubB = subscribe((r) => b.push(r))

		emit_update(STUB_RUN)

		unsubA()
		unsubB()

		expect(a).toHaveLength(1)
		expect(b).toHaveLength(1)
	})
})
