/**
 * Smoke unit test for pipeline.run_subscription.
 *
 * Invocation 2: minimal test — confirm pipeline compiles, inserts run_history
 * with status=success when source yields nothing.
 *
 * Full happy-path / dedup / re_fan_out / blacklist / max_items / source_throws
 * tests are deferred to invocation 3.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { eq } from "drizzle-orm"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import { devices, device_subscriptions, run_history, subscriptions } from "$lib/server/db/schema"
import { sources } from "$lib/server/sources/_registry"
import { run_subscription } from "./pipeline"
import type { Runtime } from "../bootstrap"
import type { SourceModule } from "../sources/_types"

// ---------------------------------------------------------------------------
// Test data dir (temp)
// ---------------------------------------------------------------------------
const TEST_DATA_DIR = join(tmpdir(), `wallrus-pipeline-test-${Date.now()}`)

beforeAll(() => {
	mkdirSync(TEST_DATA_DIR, { recursive: true })
})

afterAll(() => {
	try {
		rmSync(TEST_DATA_DIR, { recursive: true, force: true })
	} catch {
		// best-effort cleanup
	}
	// Remove mock source from registry
	delete sources["mock-test"]
})

// ---------------------------------------------------------------------------
// Mock source
// ---------------------------------------------------------------------------
const mock_source: SourceModule = {
	slug: "mock-test",
	display_name: "Mock Test Source",
	params_schema: {
		// minimal Zod-like shape for typing
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		safeParse: (v: unknown) => ({ success: true, data: v }) as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parse: (v: unknown) => v as any,
	} as SourceModule["params_schema"],
	async *fetch() {
		// Yield nothing — empty source
	},
}

// ---------------------------------------------------------------------------
// Smoke test: empty source → run_history row created with status=success
// ---------------------------------------------------------------------------

describe("run_subscription (smoke)", () => {
	test("creates run_history row with status=success when source yields nothing", async () => {
		const db = create_test_db()

		// Register mock source
		sources["mock-test"] = mock_source

		// Seed: 1 device + 1 subscription
		const device_id = uuidv7()
		const sub_id = uuidv7()
		const BASE_TIME = Date.now()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "test-device",
				name: "Test Device",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "Test Subscription",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 10,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({
				device_id,
				subscription_id: sub_id,
				created_at: BASE_TIME,
			})
			.run()

		// Build a minimal Runtime (no real services needed for empty run)
		const runtime = {
			env: {
				WALLRUS_DATA_DIR: TEST_DATA_DIR,
			},
			db,
		} as unknown as Runtime

		// Run
		await run_subscription(runtime, sub_id)

		// Assert run_history row
		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})

		expect(run_row).toBeDefined()
		expect(run_row!.status).toBe("success")
		expect(run_row!.stop_reason).toBe("source_exhausted")
		expect(run_row!.items_seen).toBe(0)
		expect(run_row!.ended_at).not.toBeNull()

		// Cleanup: remove mock source
		delete sources["mock-test"]
	})
})
