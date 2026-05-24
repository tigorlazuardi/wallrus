/**
 * Smoke test for migration 0002_run_history_skip_counter.
 *
 * Verifies that the new `items_skipped_no_device` column exists on run_history
 * and has the correct default value of 0 after running all migrations on an
 * in-memory database.
 */
import { describe, expect, test } from "bun:test"
import { create_test_db } from "./db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"

const BASE_TIME = 1_700_000_000_000

describe("migration 0002 — items_skipped_no_device column", () => {
	test("column exists with default value 0", async () => {
		const db = create_test_db()

		// Insert a subscription so the FK is satisfied
		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Test Sub",
				input_params: { subreddit: "wallpapers" },
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		// Insert a run_history row WITHOUT specifying items_skipped_no_device
		const run_id = uuidv7()
		db.insert(run_history)
			.values({
				id: run_id,
				subscription_id: sub_id,
				started_at: BASE_TIME,
				status: "running",
				input_params_snapshot: {},
			})
			.run()

		// Read it back and confirm the column is present and defaults to 0
		const row = await db.query.run_history.findFirst({
			where: (t, { eq }) => eq(t.id, run_id),
		})

		expect(row).toBeDefined()
		expect(row!.items_skipped_no_device).toBe(0)
	})

	test("column accepts non-zero values", async () => {
		const db = create_test_db()

		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "booru",
				name: "Test Sub 2",
				input_params: { tags: ["nature"] },
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		const run_id = uuidv7()
		db.insert(run_history)
			.values({
				id: run_id,
				subscription_id: sub_id,
				started_at: BASE_TIME,
				status: "success",
				stop_reason: "source_exhausted",
				ended_at: BASE_TIME + 5000,
				input_params_snapshot: {},
				items_seen: 10,
				items_new: 7,
				items_skipped_no_device: 3,
			})
			.run()

		const row = await db.query.run_history.findFirst({
			where: (t, { eq }) => eq(t.id, run_id),
		})

		expect(row).toBeDefined()
		expect(row!.items_skipped_no_device).toBe(3)
	})
})
