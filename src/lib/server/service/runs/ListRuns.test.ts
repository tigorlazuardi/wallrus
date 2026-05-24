import { describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"
import { RunService } from "./index"

const BASE_TIME = 1_700_000_000_000

function make_service(db: ReturnType<typeof create_test_db>) {
	return new RunService({ db })
}

function insert_sub(db: ReturnType<typeof create_test_db>, sub_id: string, name = "Test") {
	db.insert(subscriptions)
		.values({
			id: sub_id,
			source_slug: "reddit",
			name,
			input_params: { subreddit: "wallpapers" },
			cron: "0 * * * *",
			enabled: true,
			created_at: BASE_TIME,
		})
		.run()
}

function insert_run(
	db: ReturnType<typeof create_test_db>,
	opts: {
		sub_id: string
		status?: "running" | "success" | "failed"
		started_at?: number
	},
) {
	const run_id = uuidv7()
	db.insert(run_history)
		.values({
			id: run_id,
			subscription_id: opts.sub_id,
			started_at: opts.started_at ?? BASE_TIME,
			status: opts.status ?? "success",
			stop_reason: "source_exhausted",
			ended_at: (opts.started_at ?? BASE_TIME) + 5000,
			input_params_snapshot: {},
			items_seen: 1,
			items_new: 1,
		})
		.run()
	return run_id
}

describe("RunService.listRuns", () => {
	test("returns empty list when no runs", async () => {
		const db = create_test_db()
		const svc = make_service(db)
		const result = await svc.listRuns({ offset: 0, limit: 50 })
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
	})

	test("returns all runs ordered by started_at DESC, id DESC", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		insert_sub(db, sub_id)

		const id1 = insert_run(db, { sub_id, started_at: BASE_TIME + 1000 })
		const id2 = insert_run(db, { sub_id, started_at: BASE_TIME + 2000 })

		const svc = make_service(db)
		const result = await svc.listRuns({ offset: 0, limit: 50 })

		expect(result.total).toBe(2)
		expect(result.items[0]!.id).toBe(id2)
		expect(result.items[1]!.id).toBe(id1)
	})

	test("filters by status", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		insert_sub(db, sub_id)

		insert_run(db, { sub_id, status: "success" })
		insert_run(db, { sub_id, status: "failed" })

		const svc = make_service(db)
		const result = await svc.listRuns({ offset: 0, limit: 50, status: "failed" })

		expect(result.total).toBe(1)
		expect(result.items[0]!.status).toBe("failed")
	})

	test("filters by subscription_id", async () => {
		const db = create_test_db()
		const sub_a = uuidv7()
		const sub_b = uuidv7()
		insert_sub(db, sub_a, "Sub A")
		insert_sub(db, sub_b, "Sub B")

		insert_run(db, { sub_id: sub_a })
		insert_run(db, { sub_id: sub_b })

		const svc = make_service(db)
		const result = await svc.listRuns({ offset: 0, limit: 50, subscription_id: sub_a })

		expect(result.total).toBe(1)
		expect(result.items[0]!.subscription_id).toBe(sub_a)
	})

	test("filters by since/until", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		insert_sub(db, sub_id)

		insert_run(db, { sub_id, started_at: BASE_TIME })
		insert_run(db, { sub_id, started_at: BASE_TIME + 10_000 })
		insert_run(db, { sub_id, started_at: BASE_TIME + 20_000 })

		const svc = make_service(db)
		const result = await svc.listRuns({
			offset: 0,
			limit: 50,
			since: BASE_TIME + 5_000,
			until: BASE_TIME + 15_000,
		})

		expect(result.total).toBe(1)
		expect(result.items[0]!.started_at).toBe(BASE_TIME + 10_000)
	})
})
