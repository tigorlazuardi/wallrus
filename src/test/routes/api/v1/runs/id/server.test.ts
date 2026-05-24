/**
 * Route tests for GET /api/v1/runs/[id]
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
import { GET } from "../../../../../../routes/api/v1/runs/[id]/+server"

function make_event(id: string) {
	const url = new URL(`http://localhost/api/v1/runs/${id}`)
	const request = new Request(url.toString(), { method: "GET" })
	return {
		url,
		request,
		params: { id },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/runs/[id]" },
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

function insert_run(): string {
	const id = uuidv7()
	db.insert(run_history)
		.values({
			id,
			subscription_id: sub_id,
			started_at: Date.now(),
			ended_at: Date.now() + 1000,
			status: "success",
			input_params_snapshot: {},
			items_seen: 10,
			items_new: 5,
			items_failed_download: 0,
			items_skipped_no_device: 0,
			device_adds: {},
		})
		.run()
	return id
}

describe("GET /api/v1/runs/[id]", () => {
	test("returns 200 with run data for valid id", async () => {
		const run_id = insert_run()
		const res = await GET(make_event(run_id) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.id).toBe(run_id)
		expect(body.subscription_id).toBe(sub_id)
		expect(body.status).toBe("success")
		expect(body.items_seen).toBe(10)
		expect(body.items_new).toBe(5)
	})

	test("returns 404 for unknown id", async () => {
		const res = await GET(make_event("00000000-0000-7000-8000-000000000001") as never)
		expect(res.status).toBe(404)
	})
})
