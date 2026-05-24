import { describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { uuidv7 } from "uuidv7"
import { RunService } from "./index"

const BASE_TIME = 1_700_000_000_000

describe("RunService.getRun", () => {
	test("returns run by id", async () => {
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
			})
			.run()

		const svc = new RunService({ db })
		const result = await svc.getRun({ id: run_id })

		expect(result.id).toBe(run_id)
		expect(result.subscription_id).toBe(sub_id)
		expect(result.status).toBe("success")
	})

	test("throws AppError 404 for unknown id", async () => {
		const db = create_test_db()
		const svc = new RunService({ db })

		await expect(svc.getRun({ id: uuidv7() })).rejects.toMatchObject({ status: 404 })
	})
})
