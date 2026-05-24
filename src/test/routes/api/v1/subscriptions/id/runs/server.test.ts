/**
 * Route tests for GET /api/v1/subscriptions/[id]/runs
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
import { GET } from "../../../../../../../routes/api/v1/subscriptions/[id]/runs/+server"

function make_event(id: string, sp: Record<string, string> = {}) {
	const params = new URLSearchParams(sp)
	const url = new URL(`http://localhost/api/v1/subscriptions/${id}/runs?${params.toString()}`)
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
		route: { id: "/api/v1/subscriptions/[id]/runs" },
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

function insert_run(
	opts: { status?: "running" | "success" | "failed"; sub?: string } = {},
): string {
	const id = uuidv7()
	db.insert(run_history)
		.values({
			id,
			subscription_id: opts.sub ?? sub_id,
			started_at: Date.now(),
			status: opts.status ?? "success",
			input_params_snapshot: {},
			items_seen: 0,
			items_new: 0,
			items_failed_download: 0,
			items_skipped_no_device: 0,
			device_adds: {},
		})
		.run()
	return id
}

describe("GET /api/v1/subscriptions/[id]/runs", () => {
	test("returns empty list when no runs exist for subscription", async () => {
		const res = await GET(make_event(sub_id) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toEqual([])
		expect(body.total).toBe(0)
	})

	test("returns runs scoped to the subscription", async () => {
		const other_sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: other_sub_id,
				source_slug: "other-source",
				name: "Other Sub",
				input_params: {},
				cron: "* * * * *",
				enabled: true,
				created_at: Date.now(),
			})
			.run()

		const our_run = insert_run()
		// Insert a run for a different subscription — should not appear
		insert_run({ sub: other_sub_id })

		const res = await GET(make_event(sub_id, { limit: "10" }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].id).toBe(our_run)
		expect(body.total).toBe(1)
	})

	test("respects limit param", async () => {
		for (let i = 0; i < 5; i++) insert_run()
		const res = await GET(make_event(sub_id, { limit: "2" }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(2)
		expect(body.total).toBe(5)
	})

	test("filters by status", async () => {
		insert_run({ status: "success" })
		insert_run({ status: "failed" })
		const res = await GET(make_event(sub_id, { status: "failed" }) as never)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].status).toBe("failed")
	})
})
