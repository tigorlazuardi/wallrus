import { describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"
import { RunService } from "./index"

const BASE_TIME = 1_700_000_000_000

describe("RunService.getActiveRuns", () => {
	test("returns empty when no running runs", async () => {
		const db = create_test_db()
		const svc = new RunService({ db })
		const result = await svc.getActiveRuns({})
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
	})

	test("returns only running status rows", async () => {
		const db = create_test_db()
		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "reddit",
				name: "Test",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		// Insert one running, one success
		const running_id = uuidv7()
		db.insert(run_history)
			.values({
				id: running_id,
				subscription_id: sub_id,
				started_at: BASE_TIME,
				status: "running",
				input_params_snapshot: {},
			})
			.run()

		db.insert(run_history)
			.values({
				id: uuidv7(),
				subscription_id: sub_id,
				started_at: BASE_TIME - 1000,
				status: "success",
				stop_reason: "source_exhausted",
				ended_at: BASE_TIME,
				input_params_snapshot: {},
			})
			.run()

		const svc = new RunService({ db })
		const result = await svc.getActiveRuns({})

		expect(result.items).toHaveLength(1)
		expect(result.total).toBe(1)
		expect(result.items[0]!.id).toBe(running_id)
		expect(result.items[0]!.status).toBe("running")
	})
})
