/**
 * runs-stream.ts tests.
 *
 * Tests verify the SSE subscribe() function's behavior:
 * - on open + message, callback is called with parsed payload
 * - on error, reconnect happens after 1s, then 2s, then 4s
 * - after 3 failed reconnects, polling kicks in
 * - cleanup closes EventSource and clears timers
 *
 * Uses injectable deps (EventSource, fetch, timers) to avoid real I/O.
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { subscribe } from "./runs-stream"
import type { Run } from "$lib/schemas/runs/Run"

// ---------------------------------------------------------------------------
// Fake EventSource
// ---------------------------------------------------------------------------

type ESListener = (event: MessageEvent) => void
type ESErrorListener = (event: Event) => void

class FakeEventSource {
	static instances: FakeEventSource[] = []

	url: string
	readyState: number = 0 // CONNECTING
	private _listeners: Map<string, Set<ESListener>> = new Map()
	private _error_listeners: Set<ESErrorListener> = new Set()
	closed = false

	constructor(url: string) {
		this.url = url
		FakeEventSource.instances.push(this)
	}

	addEventListener(type: string, listener: ESListener): void {
		if (!this._listeners.has(type)) this._listeners.set(type, new Set())
		this._listeners.get(type)!.add(listener)
	}

	set onerror(handler: ESErrorListener | null) {
		if (handler) this._error_listeners.add(handler)
	}

	close(): void {
		this.readyState = 2 // CLOSED
		this.closed = true
	}

	// Test helpers — trigger events from the test
	_emit(type: string, data: string): void {
		const listeners = this._listeners.get(type)
		if (!listeners) return
		const event = { data } as MessageEvent
		for (const l of listeners) l(event)
	}

	_trigger_error(): void {
		for (const l of this._error_listeners) l(new Event("error"))
	}
}

// ---------------------------------------------------------------------------
// Fake timer state
// ---------------------------------------------------------------------------

type TimerCallback = () => void
interface FakeTimer {
	id: number
	delay: number
	cb: TimerCallback
	cleared: boolean
	type: "timeout" | "interval"
}

function make_fake_timers() {
	let next_id = 1
	const timers: FakeTimer[] = []

	function set_timeout(cb: TimerCallback, delay: number): number {
		const id = next_id++
		timers.push({ id, delay, cb, cleared: false, type: "timeout" })
		return id
	}

	function clear_timeout(id: number): void {
		const t = timers.find((t) => t.id === id)
		if (t) t.cleared = true
	}

	function set_interval(cb: TimerCallback, delay: number): number {
		const id = next_id++
		timers.push({ id, delay, cb, cleared: false, type: "interval" })
		return id
	}

	function clear_interval(id: number): void {
		const t = timers.find((t) => t.id === id)
		if (t) t.cleared = true
	}

	return {
		set_timeout,
		clear_timeout,
		set_interval,
		clear_interval,
		timers,
		// Advance: fire all non-cleared timeouts
		flush_timeouts() {
			const pending = timers.filter((t) => !t.cleared && t.type === "timeout")
			for (const t of pending) {
				t.cleared = true
				t.cb()
			}
		},
		flush_intervals() {
			const pending = timers.filter((t) => !t.cleared && t.type === "interval")
			for (const t of pending) {
				t.cb()
			}
		},
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make_deps(timers: ReturnType<typeof make_fake_timers>, fetch_items: Run[] = []) {
	const fetch_fn = (_url: string): Promise<Response> =>
		Promise.resolve(new Response(JSON.stringify({ items: fetch_items })))

	return {
		EventSource: FakeEventSource as unknown as typeof EventSource,
		fetch: fetch_fn,
		setTimeout: timers.set_timeout,
		clearTimeout: timers.clear_timeout,
		setInterval: timers.set_interval,
		clearInterval: timers.clear_interval,
	}
}

function latest_es(): FakeEventSource {
	const es = FakeEventSource.instances[FakeEventSource.instances.length - 1]
	if (!es) throw new Error("No FakeEventSource instances")
	return es
}

// ---------------------------------------------------------------------------
// Sample run fixture
// ---------------------------------------------------------------------------

const sample_run: Run = {
	id: "018f7e1a-1234-7000-8000-000000000001",
	subscription_id: "018f7e1a-1234-7000-8000-000000000002",
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	FakeEventSource.instances = []
})

describe("subscribe() — message handling", () => {
	test("calls callback with parsed run on run.update event", () => {
		const timers = make_fake_timers()
		const received: Run[] = []

		subscribe((run) => received.push(run), make_deps(timers))

		const es = FakeEventSource.instances[0]
		expect(es).toBeDefined()

		es!._emit("run.update", JSON.stringify(sample_run))

		expect(received).toHaveLength(1)
		expect(received[0]!.id).toBe(sample_run.id)
		expect(received[0]!.status).toBe("running")
	})

	test("ignores malformed JSON in event data", () => {
		const timers = make_fake_timers()
		const received: Run[] = []

		subscribe((run) => received.push(run), make_deps(timers))

		const es = FakeEventSource.instances[0]
		es!._emit("run.update", "not-valid-json{{{")

		expect(received).toHaveLength(0)
	})
})

describe("subscribe() — reconnect logic", () => {
	test("schedules reconnect after 1s on first error", () => {
		const timers = make_fake_timers()

		subscribe(() => {}, make_deps(timers))

		latest_es()._trigger_error()

		const timeout = timers.timers.find((t) => t.type === "timeout" && !t.cleared)
		expect(timeout).toBeDefined()
		expect(timeout!.delay).toBe(1_000)
	})

	test("schedules reconnect after 2s on second error", () => {
		const timers = make_fake_timers()

		subscribe(() => {}, make_deps(timers))

		// First error -> 1s timeout
		latest_es()._trigger_error()
		timers.flush_timeouts() // Fire the 1s timeout → creates new ES

		// Second error -> 2s timeout
		latest_es()._trigger_error()

		const pending_timeouts = timers.timers.filter((t) => t.type === "timeout" && !t.cleared)
		const last_timeout = pending_timeouts[pending_timeouts.length - 1]
		expect(last_timeout?.delay).toBe(2_000)
	})

	test("schedules reconnect after 4s on third error", () => {
		const timers = make_fake_timers()

		subscribe(() => {}, make_deps(timers))

		// Error 1 -> 1s
		latest_es()._trigger_error()
		timers.flush_timeouts()
		// Error 2 -> 2s
		latest_es()._trigger_error()
		timers.flush_timeouts()
		// Error 3 -> 4s
		latest_es()._trigger_error()

		const pending_timeouts = timers.timers.filter((t) => t.type === "timeout" && !t.cleared)
		const last_timeout = pending_timeouts[pending_timeouts.length - 1]
		expect(last_timeout?.delay).toBe(4_000)
	})

	test("switches to polling after 3 failed reconnects (4th error)", () => {
		const timers = make_fake_timers()

		subscribe(() => {}, make_deps(timers))

		// 3 errors with reconnects (1s, 2s, 4s)
		latest_es()._trigger_error()
		timers.flush_timeouts()
		latest_es()._trigger_error()
		timers.flush_timeouts()
		latest_es()._trigger_error()
		timers.flush_timeouts()

		// 4th error → should start polling (setInterval), no more setTimeout reconnects
		latest_es()._trigger_error()

		const poll_interval = timers.timers.find((t) => t.type === "interval" && !t.cleared)
		expect(poll_interval).toBeDefined()
		expect(poll_interval!.delay).toBe(10_000)
	})
})

describe("subscribe() — cleanup", () => {
	test("cleanup closes EventSource", () => {
		const timers = make_fake_timers()

		const cleanup = subscribe(() => {}, make_deps(timers))

		const es = FakeEventSource.instances[0]
		expect(es!.closed).toBe(false)

		cleanup()

		expect(es!.closed).toBe(true)
	})

	test("cleanup clears pending reconnect timer", () => {
		const timers = make_fake_timers()

		const cleanup = subscribe(() => {}, make_deps(timers))

		// Trigger an error to schedule a reconnect timer
		latest_es()._trigger_error()
		expect(timers.timers.some((t) => t.type === "timeout" && !t.cleared)).toBe(true)

		cleanup()

		// All timeouts should be cleared
		const active_timeouts = timers.timers.filter((t) => t.type === "timeout" && !t.cleared)
		expect(active_timeouts).toHaveLength(0)
	})

	test("cleanup stops polling interval", () => {
		const timers = make_fake_timers()

		const cleanup = subscribe(() => {}, make_deps(timers))

		// Drive to polling state (4 errors)
		latest_es()._trigger_error()
		timers.flush_timeouts()
		latest_es()._trigger_error()
		timers.flush_timeouts()
		latest_es()._trigger_error()
		timers.flush_timeouts()
		latest_es()._trigger_error()

		// Polling should be active
		expect(timers.timers.some((t) => t.type === "interval" && !t.cleared)).toBe(true)

		cleanup()

		// Poll interval should be cleared
		const active_intervals = timers.timers.filter((t) => t.type === "interval" && !t.cleared)
		expect(active_intervals).toHaveLength(0)
	})

	test("after cleanup, no new reconnects happen on error", () => {
		const timers = make_fake_timers()

		const cleanup = subscribe(() => {}, make_deps(timers))

		cleanup()

		const es = FakeEventSource.instances[0]!
		es._trigger_error()

		// No new timeouts should be scheduled after cleanup
		const scheduled = timers.timers.filter((t) => !t.cleared)
		expect(scheduled).toHaveLength(0)
	})
})
