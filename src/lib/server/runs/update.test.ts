import { describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"
import { update_run } from "./update"
import { subscribe } from "./bus"

const BASE_TIME = 1_700_000_000_000

function make_runtime(db: ReturnType<typeof create_test_db>) {
	return { db } as Parameters<typeof update_run>[0]
}

describe("update_run", () => {
	test("returns updated row", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Test",
				input_params: { subreddit: "wallpapers" },
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
				status: "running",
				input_params_snapshot: {},
			})
			.run()

		const updated = await update_run(make_runtime(db), run_id, { items_seen: 5 })

		expect(updated.id).toBe(run_id)
		expect(updated.items_seen).toBe(5)
	})

	test("emits exactly one event per call", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Test",
				input_params: { subreddit: "wallpapers" },
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
				status: "running",
				input_params_snapshot: {},
			})
			.run()

		const emits: unknown[] = []
		const unsub = subscribe((r) => emits.push(r))

		await update_run(make_runtime(db), run_id, { items_seen: 1 })
		await update_run(make_runtime(db), run_id, { items_seen: 2 })

		unsub()

		expect(emits).toHaveLength(2)
	})

	test("throws AppError for unknown run_id", async () => {
		const db = create_test_db()
		const runtime = make_runtime(db)

		await expect(update_run(runtime, "does-not-exist", { items_seen: 1 })).rejects.toThrow()
	})
})
