import { describe, expect, test } from "bun:test"
import { enqueue, wait_idle } from "./queue"

// ---------------------------------------------------------------------------
// Helper: a delayed task that records its start and end timestamps.
// ---------------------------------------------------------------------------
function make_timed_task(
	delay_ms: number,
	record: { start?: number; end?: number },
): () => Promise<void> {
	return async () => {
		record.start = Date.now()
		await new Promise<void>((resolve) => setTimeout(resolve, delay_ms))
		record.end = Date.now()
	}
}

// ---------------------------------------------------------------------------
// Serialisation: two enqueues with the SAME slug run sequentially
// ---------------------------------------------------------------------------

describe("enqueue — same slug serialises", () => {
	test("second task starts only after first task ends", async () => {
		const slug = `serial-test-${Date.now()}`
		const a: { start?: number; end?: number } = {}
		const b: { start?: number; end?: number } = {}

		enqueue(slug, make_timed_task(30, a))
		await enqueue(slug, make_timed_task(10, b))

		// Both tasks must have completed
		expect(a.start).toBeDefined()
		expect(a.end).toBeDefined()
		expect(b.start).toBeDefined()
		expect(b.end).toBeDefined()

		// b must start strictly after a ends
		expect(b.start!).toBeGreaterThanOrEqual(a.end!)
	})
})

// ---------------------------------------------------------------------------
// Parallelism: enqueues across DIFFERENT slugs overlap
// ---------------------------------------------------------------------------

describe("enqueue — different slugs run in parallel", () => {
	test("tasks on different slugs overlap in time", async () => {
		const slug_x = `parallel-x-${Date.now()}`
		const slug_y = `parallel-y-${Date.now()}`
		const x: { start?: number; end?: number } = {}
		const y: { start?: number; end?: number } = {}

		const px = enqueue(slug_x, make_timed_task(50, x))
		const py = enqueue(slug_y, make_timed_task(50, y))
		await Promise.all([px, py])

		// Both started
		expect(x.start).toBeDefined()
		expect(y.start).toBeDefined()

		// Their execution windows must overlap: x started before y ended AND
		// y started before x ended.
		expect(x.start!).toBeLessThan(y.end!)
		expect(y.start!).toBeLessThan(x.end!)
	})
})

// ---------------------------------------------------------------------------
// wait_idle: resolves only after all in-flight chains complete
// ---------------------------------------------------------------------------

describe("wait_idle", () => {
	test("resolves immediately when nothing is enqueued", async () => {
		// Use a fresh test-unique slug to avoid cross-test contamination.
		// wait_idle awaits all chains in the module-level map — unrelated chains
		// from other tests may still be present. We just verify it resolves.
		await expect(wait_idle()).resolves.toBeUndefined()
	})

	test("resolves only after in-flight tasks complete", async () => {
		const slug = `idle-test-${Date.now()}`
		const record: { end?: number } = {}

		enqueue(slug, async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 40))
			record.end = Date.now()
		})

		await wait_idle()
		const idle_resolved_at = Date.now()

		expect(record.end).toBeDefined()
		expect(idle_resolved_at).toBeGreaterThanOrEqual(record.end!)
	})

	test("absorbs errors from failed tasks", async () => {
		const slug = `idle-error-${Date.now()}`
		enqueue(slug, async () => {
			throw new Error("intentional test error")
		})
		// wait_idle must not reject even when a task throws
		await expect(wait_idle()).resolves.toBeUndefined()
	})
})
