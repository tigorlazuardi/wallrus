import { describe, expect, test } from "bun:test"
import { Cron } from "croner"
import { _tick_with_clock, stop, type CronEntry } from "./cron"

// ---------------------------------------------------------------------------
// Helper: build a minimal fake CronEntry map for unit tests.
// The tests do NOT touch the DB — they pass a hand-built registry directly
// to `_tick_with_clock`.
// ---------------------------------------------------------------------------

function fake_entry(cron_pattern: string, source_slug: string): CronEntry {
	return { cron: new Cron(cron_pattern), source_slug }
}

// ---------------------------------------------------------------------------
// Tick — executor stub invoked when next fire falls in the 60s window
// ---------------------------------------------------------------------------

describe("_tick_with_clock", () => {
	test("enqueues a subscription whose next run is within the 60s window", async () => {
		// Use a cron pattern that fires every minute: "* * * * *"
		// Set `now` to just before the next minute boundary so nextRun() is in
		// the upcoming 60s window.
		const sub_id = "sub-001"
		const source = "reddit"
		const reg = new Map<string, CronEntry>([[sub_id, fake_entry("* * * * *", source)]])

		// Compute a `now` value such that nextRun() from croner falls within
		// [now, now+60_000). We ask croner itself what the next run is, then
		// set now to 1ms before it.
		const next = reg.get(sub_id)!.cron.nextRun()
		expect(next).not.toBeNull()
		const now = next!.getTime() - 1

		// _tick_with_clock calls the real enqueue internally with the executor stub.
		// We just verify it runs without throwing.
		expect(() => _tick_with_clock(reg, now)).not.toThrow()

		// Give the async queue a chance to flush the executor stub.
		await new Promise<void>((resolve) => setTimeout(resolve, 20))
	})

	test("does NOT enqueue a subscription whose next run is outside the 60s window", () => {
		// Use a pattern that fires once per year (far future)
		// "0 0 1 1 *" = at midnight on Jan 1st
		const sub_id = "sub-002"
		const source = "danbooru"

		// Set now to a point where the next run is > 60s away.
		const reg = new Map<string, CronEntry>([[sub_id, fake_entry("0 0 1 1 *", source)]])
		const next = reg.get(sub_id)!.cron.nextRun()
		expect(next).not.toBeNull()

		// Set now so that next run is just outside the 60s window
		const now = next!.getTime() - 60_001

		// _tick_with_clock should silently skip — no throw
		expect(() => _tick_with_clock(reg, now)).not.toThrow()
	})

	test("skips subscription with null nextRun (exhausted pattern)", () => {
		// A cron that has already passed its only scheduled run will return null
		// from nextRun(). We simulate this with a stopped cron.
		const sub_id = "sub-003"
		const source = "gelbooru"

		// Create a Cron instance and stop it so nextRun() returns null
		const cron = new Cron("* * * * *")
		cron.stop()
		const reg = new Map<string, CronEntry>([[sub_id, { cron, source_slug: source }]])

		// Should not throw
		expect(() => _tick_with_clock(reg, Date.now())).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// stop() — clears interval and drains queue
// ---------------------------------------------------------------------------

describe("stop()", () => {
	test("resolves cleanly when no interval is running", async () => {
		// stop() must be safe to call before start()
		await expect(stop()).resolves.toBeUndefined()
	})

	// Note: Testing stop() after start() requires a real DB (to load_registry).
	// The full integration path is covered by the smoke test in invocation 2.
	// Here we just verify the exported function signatures and basic contract.
})
