/**
 * Smoke test for migration 0003_run_history_prune_trigger.
 *
 * Verifies that after inserting 105 rows for the same subscription, only 100
 * remain — and they are the 100 with the highest started_at values (i.e. the
 * most recent 100 rows).
 */
import { describe, expect, test } from "bun:test"
import { create_test_db } from "./db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"
import { desc } from "drizzle-orm"

const BASE_TIME = 1_700_000_000_000

describe("migration 0003 — run_history prune trigger", () => {
	test("trigger fires: only 100 rows remain after inserting 105", async () => {
		const db = create_test_db()

		// Insert a subscription so the FK is satisfied
		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Prune Test Sub",
				input_params: { subreddit: "wallpapers" },
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		// Insert 105 rows with descending started_at so the oldest ones are at
		// the bottom. Row i has started_at = BASE_TIME + i*1000, so row 104 is
		// newest. After pruning, rows 0..4 (oldest five) should be gone.
		for (let i = 0; i < 105; i++) {
			db.insert(run_history)
				.values({
					id: uuidv7(),
					subscription_id: sub_id,
					started_at: BASE_TIME + i * 1000,
					status: "success",
					stop_reason: "source_exhausted",
					ended_at: BASE_TIME + i * 1000 + 5000,
					input_params_snapshot: {},
					items_seen: i,
					items_new: i,
				})
				.run()
		}

		// Count rows for this subscription
		const rows = await db.query.run_history.findMany({
			where: (t, { eq }) => eq(t.subscription_id, sub_id),
			orderBy: (t) => [desc(t.started_at), desc(t.id)],
		})

		expect(rows.length).toBe(100)

		// Confirm all remaining rows have started_at >= the 6th oldest row
		// (i.e. the 5 oldest rows with started_at = BASE_TIME + 0..4*1000 are gone)
		const min_started_at = rows[rows.length - 1]!.started_at
		expect(min_started_at).toBeGreaterThanOrEqual(BASE_TIME + 5 * 1000)

		// Confirm the newest row (started_at = BASE_TIME + 104*1000) is present
		const max_started_at = rows[0]!.started_at
		expect(max_started_at).toBe(BASE_TIME + 104 * 1000)
	})

	test("trigger does not prune when fewer than 100 rows exist", async () => {
		const db = create_test_db()

		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Prune Test Sub 2",
				input_params: { subreddit: "earthporn" },
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		for (let i = 0; i < 50; i++) {
			db.insert(run_history)
				.values({
					id: uuidv7(),
					subscription_id: sub_id,
					started_at: BASE_TIME + i * 1000,
					status: "running",
					input_params_snapshot: {},
				})
				.run()
		}

		const rows = await db.query.run_history.findMany({
			where: (t, { eq }) => eq(t.subscription_id, sub_id),
		})

		expect(rows.length).toBe(50)
	})

	test("trigger prunes per subscription independently", async () => {
		const db = create_test_db()

		// Two subscriptions — sub_a gets 101 rows, sub_b gets 5
		const sub_a = uuidv7()
		const sub_b = uuidv7()

		for (const [sub_id, name] of [
			[sub_a, "Sub A"],
			[sub_b, "Sub B"],
		] as [string, string][]) {
			db.insert(subscriptions)
				.values({
					id: sub_id,
					source_slug: "reddit",
					name,
					input_params: {},
					cron: "0 * * * *",
					enabled: true,
					created_at: BASE_TIME,
				})
				.run()
		}

		for (let i = 0; i < 101; i++) {
			db.insert(run_history)
				.values({
					id: uuidv7(),
					subscription_id: sub_a,
					started_at: BASE_TIME + i * 1000,
					status: "running",
					input_params_snapshot: {},
				})
				.run()
		}

		for (let i = 0; i < 5; i++) {
			db.insert(run_history)
				.values({
					id: uuidv7(),
					subscription_id: sub_b,
					started_at: BASE_TIME + i * 1000,
					status: "running",
					input_params_snapshot: {},
				})
				.run()
		}

		const rows_a = await db.query.run_history.findMany({
			where: (t, { eq }) => eq(t.subscription_id, sub_a),
		})
		const rows_b = await db.query.run_history.findMany({
			where: (t, { eq }) => eq(t.subscription_id, sub_b),
		})

		expect(rows_a.length).toBe(100)
		expect(rows_b.length).toBe(5)
	})
})
