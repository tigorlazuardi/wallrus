/**
 * Crash recovery test for the daemon startup sweep.
 *
 * `recover_orphan_runs` is called during `boot()` after migrations. It marks
 * any `run_history` row stuck in `status='running'` as `status='failed'` with
 * `stop_reason='daemon_crash'`. This simulates a mid-run daemon crash.
 *
 * We test the exported function directly against an in-memory DB.
 */

import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import { run_history, subscriptions, devices, device_subscriptions } from "$lib/server/db/schema"
import { recover_orphan_runs } from "./bootstrap"

describe("recover_orphan_runs", () => {
	test("flips running→failed with daemon_crash stop_reason", () => {
		const db = create_test_db()
		const BASE_TIME = Date.now()

		// Seed minimal subscription (required by FK)
		const device_id = uuidv7()
		const sub_id = uuidv7()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "device-crash-test",
				name: "Crash Test Device",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-source",
				name: "Crash Test Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({ device_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		// Insert an orphaned "running" run (simulates crash mid-run 60 seconds ago)
		const run_id = uuidv7()
		db.insert(run_history)
			.values({
				id: run_id,
				subscription_id: sub_id,
				started_at: BASE_TIME - 60_000,
				ended_at: null,
				status: "running",
				error: null,
				stop_reason: null,
				input_params_snapshot: {},
				items_seen: 5,
				items_new: 3,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()

		// Confirm row is in running state
		const before = db.query.run_history.findFirst({ where: eq(run_history.id, run_id) }).sync()
		expect(before!.status).toBe("running")
		expect(before!.ended_at).toBeNull()

		// Run the recovery sweep
		recover_orphan_runs(db)

		// Assert row is now failed
		const after = db.query.run_history.findFirst({ where: eq(run_history.id, run_id) }).sync()
		expect(after!.status).toBe("failed")
		expect(after!.stop_reason).toBe("daemon_crash")
		expect(after!.error).toBe("daemon crashed mid-run")
		expect(after!.ended_at).not.toBeNull()
	})

	test("does not affect already-completed runs", () => {
		const db = create_test_db()
		const BASE_TIME = Date.now()

		const device_id = uuidv7()
		const sub_id = uuidv7()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "device-ok",
				name: "OK Device",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock",
				name: "OK Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({ device_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		// Insert a completed "success" run
		const success_run_id = uuidv7()
		db.insert(run_history)
			.values({
				id: success_run_id,
				subscription_id: sub_id,
				started_at: BASE_TIME - 120_000,
				ended_at: BASE_TIME - 60_000,
				status: "success",
				stop_reason: "source_exhausted",
				input_params_snapshot: {},
				items_seen: 10,
				items_new: 10,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()

		// Insert a completed "failed" run
		const failed_run_id = uuidv7()
		db.insert(run_history)
			.values({
				id: failed_run_id,
				subscription_id: sub_id,
				started_at: BASE_TIME - 240_000,
				ended_at: BASE_TIME - 180_000,
				status: "failed",
				stop_reason: "error",
				error: "previous error",
				input_params_snapshot: {},
				items_seen: 0,
				items_new: 0,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()

		recover_orphan_runs(db)

		// Neither should have been touched
		const success_row = db.query.run_history
			.findFirst({ where: eq(run_history.id, success_run_id) })
			.sync()
		expect(success_row!.status).toBe("success")
		expect(success_row!.stop_reason).toBe("source_exhausted")

		const failed_row = db.query.run_history
			.findFirst({ where: eq(run_history.id, failed_run_id) })
			.sync()
		expect(failed_row!.status).toBe("failed")
		expect(failed_row!.stop_reason).toBe("error")
		expect(failed_row!.error).toBe("previous error")
	})
})
