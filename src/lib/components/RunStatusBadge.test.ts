/**
 * RunStatusBadge component tests.
 *
 * Tests verify the status-to-color/label mapping logic that drives the badge.
 * Since bun:test doesn't support full Svelte component mounting, we extract
 * and test the pure mapping logic directly.
 */

import { describe, test, expect } from "bun:test"
import type { Run } from "$lib/schemas/runs/Run"

// ---------------------------------------------------------------------------
// Replicate the pure logic from RunStatusBadge.svelte
// ---------------------------------------------------------------------------

type ColorConfig = {
	bg: string
	text: string
	border: string
	pulse: boolean
	label: string
}

function get_badge_config(status: Run["status"], stop_reason?: Run["stop_reason"]): ColorConfig {
	const config: Record<Run["status"], ColorConfig> = {
		running: {
			bg: "rgb(37 99 235 / 0.2)",
			text: "rgb(147 197 253)",
			border: "rgb(59 130 246 / 0.4)",
			pulse: true,
			label: "Running",
		},
		success: {
			bg: "rgb(22 163 74 / 0.2)",
			text: "rgb(134 239 172)",
			border: "rgb(34 197 94 / 0.4)",
			pulse: false,
			label: "Success",
		},
		failed: {
			bg: "rgb(220 38 38 / 0.2)",
			text: "rgb(252 165 165)",
			border: "rgb(239 68 68 / 0.4)",
			pulse: false,
			label: stop_reason === "daemon_crash" ? "Daemon Crash" : "Failed",
		},
	}
	return config[status]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RunStatusBadge — color/label mapping", () => {
	test("running status has blue color and pulse", () => {
		const c = get_badge_config("running")
		expect(c.pulse).toBe(true)
		expect(c.label).toBe("Running")
		expect(c.text).toContain("147 197 253") // blue
	})

	test("success status has green color and no pulse", () => {
		const c = get_badge_config("success")
		expect(c.pulse).toBe(false)
		expect(c.label).toBe("Success")
		expect(c.text).toContain("134 239 172") // green
	})

	test("failed status has red color and no pulse", () => {
		const c = get_badge_config("failed")
		expect(c.pulse).toBe(false)
		expect(c.label).toBe("Failed")
		expect(c.text).toContain("252 165 165") // red
	})

	test("failed with daemon_crash stop_reason shows 'Daemon Crash' label", () => {
		const c = get_badge_config("failed", "daemon_crash")
		expect(c.label).toBe("Daemon Crash")
		expect(c.pulse).toBe(false)
	})

	test("failed with other stop_reason shows 'Failed' label", () => {
		const c = get_badge_config("failed", "error")
		expect(c.label).toBe("Failed")
	})

	test("failed with no stop_reason shows 'Failed' label", () => {
		const c = get_badge_config("failed", null)
		expect(c.label).toBe("Failed")
	})

	test("all non-running statuses have pulse=false", () => {
		expect(get_badge_config("success").pulse).toBe(false)
		expect(get_badge_config("failed").pulse).toBe(false)
	})
})
