/**
 * Route tests for GET /api/v1/runs/active
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { RunService } from "$lib/server/service/runs"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import type { Runtime } from "$lib/server/bootstrap"
import { run_history, subscriptions } from "$lib/server/db/schema"
import { GET } from "../../../../../../routes/api/v1/runs/active/+server"

function make_event() {
	const url = new URL("http://localhost/api/v1/runs/active")
	const request = new Request(url.toString(), { method: "GET" })
	return {
		url,
		request,
		params: {},
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/runs/active" },
	}
}

let db: ReturnType<typeof create_test_db>
let sub_id: string

beforeEach(() => {
	db = create_test_db()
	const services = {
		devices: new DeviceService({ db }),
		subscriptions: new SubscriptionService({ db }),
		images: new ImageService({ db }),
		runs: new RunService({ db }),
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)

	sub_id = uuidv7()
	db.insert(subscriptions)
		.values({
			id: sub_id,
			source_slug: "test-source",
			name: "Test Sub",
			input_params: {},
			cron: "* * * * *",
			enabled: true,
			created_at: Date.now(),
		})
		.run()
})

afterEach(() => {
	_reset_runtime_for_tests()
})

describe("GET /api/v1/runs/active", () => {
	test("returns empty list when no runs are running", async () => {
		// Insert a finished run
		db.insert(run_history)
			.values({
				id: uuidv7(),
				subscription_id: sub_id,
				started_at: Date.now(),
				ended_at: Date.now() + 1000,
				status: "success",
				input_params_snapshot: {},
				items_seen: 0,
				items_new: 0,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()

		const res = await GET(make_event() as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toEqual([])
		expect(body.total).toBe(0)
	})

	test("returns only running status runs", async () => {
		// Insert a running run
		db.insert(run_history)
			.values({
				id: uuidv7(),
				subscription_id: sub_id,
				started_at: Date.now(),
				status: "running",
				input_params_snapshot: {},
				items_seen: 5,
				items_new: 2,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()
		// Insert a finished run (should not appear)
		db.insert(run_history)
			.values({
				id: uuidv7(),
				subscription_id: sub_id,
				started_at: Date.now() - 10000,
				ended_at: Date.now() - 1000,
				status: "success",
				input_params_snapshot: {},
				items_seen: 10,
				items_new: 5,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			})
			.run()

		const res = await GET(make_event() as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].status).toBe("running")
		expect(body.total).toBe(1)
	})
})
