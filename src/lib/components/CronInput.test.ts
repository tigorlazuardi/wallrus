/**
 * CronInput component tests.
 *
 * CronInput validates a cron expression via `croner` and exposes:
 *   - { valid: false, error } for invalid expressions
 *   - { valid: true, next_runs: Date[] } with 3 upcoming run times
 *
 * Tests replicate the component's pure validation logic without mounting.
 */
import { describe, expect, test } from "bun:test"
import { Cron } from "croner"

// ---------------------------------------------------------------------------
// Replicated CronInput validation logic (mirrors the component's $derived)
// ---------------------------------------------------------------------------

type ValidationResult = { valid: true; next_runs: Date[] } | { valid: false; error: string }

function validate_cron(expr: string): ValidationResult {
	if (!expr || !expr.trim()) {
		return { valid: false, error: "Cron expression is required." }
	}
	try {
		const job = new Cron(expr.trim())
		const runs: Date[] = []
		let cursor: Date | null = null
		for (let i = 0; i < 3; i++) {
			const next = job.nextRun(cursor ?? undefined)
			if (!next) break
			runs.push(next)
			cursor = next
		}
		return { valid: true, next_runs: runs }
	} catch {
		return { valid: false, error: "Invalid cron expression." }
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CronInput — invalid expressions", () => {
	test("empty string is invalid", () => {
		const result = validate_cron("")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.error).toContain("required")
		}
	})

	test("whitespace-only string is invalid", () => {
		const result = validate_cron("   ")
		expect(result.valid).toBe(false)
	})

	test("garbage string is invalid", () => {
		const result = validate_cron("not a cron")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.error).toContain("Invalid")
		}
	})

	test("partial expression is invalid", () => {
		const result = validate_cron("* * *")
		expect(result.valid).toBe(false)
	})
})

describe("CronInput — valid expressions", () => {
	test("standard 5-field cron returns 3 next runs", () => {
		const result = validate_cron("0 * * * *")
		expect(result.valid).toBe(true)
		if (result.valid) {
			expect(result.next_runs).toHaveLength(3)
			for (const run of result.next_runs) {
				expect(run).toBeInstanceOf(Date)
			}
		}
	})

	test("every-minute cron returns 3 strictly ascending dates", () => {
		const result = validate_cron("* * * * *")
		expect(result.valid).toBe(true)
		if (result.valid) {
			expect(result.next_runs).toHaveLength(3)
			const [a, b, c] = result.next_runs
			expect(b!.getTime()).toBeGreaterThan(a!.getTime())
			expect(c!.getTime()).toBeGreaterThan(b!.getTime())
		}
	})

	test("daily midnight cron is valid and returns 3 runs", () => {
		const result = validate_cron("0 0 * * *")
		expect(result.valid).toBe(true)
		if (result.valid) {
			expect(result.next_runs).toHaveLength(3)
		}
	})

	test("weekly cron is valid", () => {
		const result = validate_cron("0 9 * * 1")
		expect(result.valid).toBe(true)
	})
})
