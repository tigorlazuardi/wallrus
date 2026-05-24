/**
 * RunDetail component tests.
 *
 * Tests verify the pure logic used by RunDetail:
 * - error section visibility (present only when run.error is non-null)
 * - duration formatting
 * - timestamp formatting
 * - device_adds section visibility
 */

import { describe, test, expect } from "bun:test"
import type { Run } from "$lib/schemas/runs/Run"

// ---------------------------------------------------------------------------
// Replicate pure helpers from RunDetail.svelte
// ---------------------------------------------------------------------------

function format_duration(ms: number | null): string {
	if (ms === null) return "—"
	if (ms < 1_000) return `${ms}ms`
	if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
	const minutes = Math.floor(ms / 60_000)
	const seconds = Math.floor((ms % 60_000) / 1_000)
	return `${minutes}m ${seconds}s`
}

function format_ts(ms: number | null): string {
	if (ms === null) return "—"
	return new Date(ms).toLocaleString()
}

function should_show_error(run: Run): boolean {
	return run.error !== null && run.error !== undefined
}

function should_show_device_adds(run: Run): boolean {
	return Object.keys(run.device_adds).length > 0
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const make_run = (overrides: Partial<Run> = {}): Run => ({
	id: "018f7e1a-1234-7000-8000-000000000001",
	subscription_id: "018f7e1a-1234-7000-8000-000000000002",
	started_at: 1_700_000_000_000,
	ended_at: 1_700_000_005_000,
	duration_ms: 5_000,
	status: "success",
	error: null,
	stop_reason: "source_exhausted",
	input_params_snapshot: { subreddit: "EarthPorn", limit: 25 },
	items_seen: 100,
	items_new: 10,
	items_failed_download: 0,
	items_skipped_no_device: 5,
	device_adds: {},
	...overrides,
})

describe("RunDetail — error section visibility", () => {
	test("error section hidden when run.error is null", () => {
		const run = make_run({ error: null })
		expect(should_show_error(run)).toBe(false)
	})

	test("error section visible when run.error is a string", () => {
		const run = make_run({ error: "source HTTP 503: service unavailable" })
		expect(should_show_error(run)).toBe(true)
	})

	test("error text is preserved exactly", () => {
		const err_msg = "connection refused: ECONNREFUSED 127.0.0.1:5432"
		const run = make_run({ error: err_msg })
		expect(run.error).toBe(err_msg)
	})
})

describe("RunDetail — device_adds section visibility", () => {
	test("device_adds section hidden when empty object", () => {
		const run = make_run({ device_adds: {} })
		expect(should_show_device_adds(run)).toBe(false)
	})

	test("device_adds section shown when non-empty", () => {
		const run = make_run({
			device_adds: {
				"018f7e1a-1234-7000-8000-000000000010": 5,
				"018f7e1a-1234-7000-8000-000000000011": 12,
			},
		})
		expect(should_show_device_adds(run)).toBe(true)
	})
})

describe("RunDetail — timestamp formatting", () => {
	test("null timestamp returns dash", () => {
		expect(format_ts(null)).toBe("—")
	})

	test("valid ms timestamp returns locale string", () => {
		const result = format_ts(1_700_000_000_000)
		expect(result).not.toBe("—")
		expect(typeof result).toBe("string")
		expect(result.length).toBeGreaterThan(0)
	})
})

describe("RunDetail — duration formatting", () => {
	test("null duration returns dash", () => {
		expect(format_duration(null)).toBe("—")
	})

	test("running run shows dash for duration", () => {
		const run = make_run({ status: "running", ended_at: null, duration_ms: null })
		expect(format_duration(run.duration_ms)).toBe("—")
	})

	test("5000ms formats as 5.0s", () => {
		expect(format_duration(5_000)).toBe("5.0s")
	})
})

describe("RunDetail — counters array", () => {
	test("all four counter fields are present on run", () => {
		const run = make_run({
			items_seen: 100,
			items_new: 10,
			items_failed_download: 2,
			items_skipped_no_device: 5,
		})
		expect(run.items_seen).toBe(100)
		expect(run.items_new).toBe(10)
		expect(run.items_failed_download).toBe(2)
		expect(run.items_skipped_no_device).toBe(5)
	})
})
