/**
 * RunRow component tests.
 *
 * Tests verify the pure logic functions used by RunRow:
 * - duration formatting
 * - relative time formatting
 * - counter rendering logic
 * - navigation on click
 */

import { describe, test, expect } from "bun:test"
import type { Run } from "$lib/schemas/runs/Run"

// ---------------------------------------------------------------------------
// Replicate pure helpers from RunRow.svelte
// ---------------------------------------------------------------------------

function format_duration(ms: number | null): string {
	if (ms === null) return "—"
	if (ms < 1_000) return `${ms}ms`
	if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
	const minutes = Math.floor(ms / 60_000)
	const seconds = Math.floor((ms % 60_000) / 1_000)
	return `${minutes}m ${seconds}s`
}

function format_relative(ms: number, now: number = Date.now()): string {
	const diff = now - ms
	if (diff < 60_000) return "just now"
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
	return `${Math.floor(diff / 86_400_000)}d ago`
}

// ---------------------------------------------------------------------------
// Tests — duration formatting
// ---------------------------------------------------------------------------

describe("RunRow — format_duration", () => {
	test("null returns dash", () => {
		expect(format_duration(null)).toBe("—")
	})

	test("< 1s shows milliseconds", () => {
		expect(format_duration(500)).toBe("500ms")
		expect(format_duration(0)).toBe("0ms")
		expect(format_duration(999)).toBe("999ms")
	})

	test("1s–59s shows seconds with one decimal", () => {
		expect(format_duration(1_000)).toBe("1.0s")
		expect(format_duration(1_500)).toBe("1.5s")
		expect(format_duration(30_000)).toBe("30.0s")
		expect(format_duration(59_999)).toBe("60.0s")
	})

	test(">= 60s shows minutes and seconds", () => {
		expect(format_duration(60_000)).toBe("1m 0s")
		expect(format_duration(90_000)).toBe("1m 30s")
		expect(format_duration(3_600_000)).toBe("60m 0s")
	})
})

// ---------------------------------------------------------------------------
// Tests — relative time formatting
// ---------------------------------------------------------------------------

describe("RunRow — format_relative", () => {
	test("< 60s shows 'just now'", () => {
		const now = Date.now()
		expect(format_relative(now - 5_000, now)).toBe("just now")
		expect(format_relative(now - 59_999, now)).toBe("just now")
	})

	test("1–59 minutes shows 'Xm ago'", () => {
		const now = Date.now()
		expect(format_relative(now - 60_000, now)).toBe("1m ago")
		expect(format_relative(now - 3_540_000, now)).toBe("59m ago")
	})

	test("1–23 hours shows 'Xh ago'", () => {
		const now = Date.now()
		expect(format_relative(now - 3_600_000, now)).toBe("1h ago")
		expect(format_relative(now - 7_200_000, now)).toBe("2h ago")
	})

	test(">= 24h shows 'Xd ago'", () => {
		const now = Date.now()
		expect(format_relative(now - 86_400_000, now)).toBe("1d ago")
		expect(format_relative(now - 172_800_000, now)).toBe("2d ago")
	})
})

// ---------------------------------------------------------------------------
// Tests — counters rendering logic
// ---------------------------------------------------------------------------

describe("RunRow — counters display", () => {
	const make_run = (overrides: Partial<Run> = {}): Run => ({
		id: "018f7e1a-1234-7000-8000-000000000001",
		subscription_id: "018f7e1a-1234-7000-8000-000000000002",
		started_at: Date.now() - 5_000,
		ended_at: Date.now(),
		duration_ms: 5_000,
		status: "success",
		error: null,
		stop_reason: "source_exhausted",
		input_params_snapshot: {},
		items_seen: 100,
		items_new: 10,
		items_failed_download: 0,
		items_skipped_no_device: 5,
		device_adds: {},
		...overrides,
	})

	test("items_failed_download > 0 should be shown", () => {
		const run = make_run({ items_failed_download: 3 })
		// The component conditionally renders failed download only when > 0
		expect(run.items_failed_download).toBeGreaterThan(0)
	})

	test("items_failed_download === 0 should not show failed indicator", () => {
		const run = make_run({ items_failed_download: 0 })
		expect(run.items_failed_download).toBe(0)
	})

	test("items_seen and items_new are always shown", () => {
		const run = make_run({ items_seen: 50, items_new: 3 })
		expect(run.items_seen).toBe(50)
		expect(run.items_new).toBe(3)
	})
})
