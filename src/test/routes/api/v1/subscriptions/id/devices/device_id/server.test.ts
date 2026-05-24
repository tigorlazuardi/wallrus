/**
 * Route tests for DELETE /api/v1/subscriptions/[id]/devices/[device_id].
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { create_test_db } from "$test/db"
import { DeviceService } from "$lib/server/service/devices"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import type { Runtime } from "$lib/server/bootstrap"
import { DELETE } from "../../../../../../../../routes/api/v1/subscriptions/[id]/devices/[device_id]/+server"

const MOCK_SOURCE_SLUG = "mock-source"
const VALID_CREATE = {
	source_slug: MOCK_SOURCE_SLUG,
	name: "Unlink Sub",
	input_params: {},
	cron: "*/5 * * * *",
}
const DEFAULT_CRITERIA = { nsfw: "all" as const }

function make_delete_event(subscription_id: string, device_id: string) {
	const url = new URL(
		`http://localhost/api/v1/subscriptions/${subscription_id}/devices/${device_id}`,
	)
	const request = new Request(url.toString(), { method: "DELETE" })
	return {
		url,
		request,
		params: { id: subscription_id, device_id },
		locals: {},
		cookies: {} as unknown,
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: "/api/v1/subscriptions/[id]/devices/[device_id]" },
	}
}

let db: ReturnType<typeof create_test_db>
let sub_svc: SubscriptionService
let dev_svc: DeviceService

beforeEach(() => {
	db = create_test_db()
	sub_svc = new SubscriptionService({ db })
	dev_svc = new DeviceService({ db })
	const services = {
		devices: dev_svc,
		subscriptions: sub_svc,
		images: new ImageService({ db }),
		runs: {} as never,
	}
	set_runtime({ db, services, env: {} as never, sdk: {} as never } as Runtime)

	sources[MOCK_SOURCE_SLUG] = {
		slug: MOCK_SOURCE_SLUG,
		display_name: "Mock Source",
		params_schema: z.object({}).passthrough(),
		async *fetch() {},
	}
})

afterEach(() => {
	delete sources[MOCK_SOURCE_SLUG]
	_reset_runtime_for_tests()
})

describe("DELETE /api/v1/subscriptions/[id]/devices/[device_id]", () => {
	test("unlinks device, returns 204", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const dev = await dev_svc.createDevice({
			slug: "phone",
			name: "Phone",
			filter_criteria: DEFAULT_CRITERIA,
		})
		await sub_svc.linkDevice({ subscription_id: sub.id, device_id: dev.id })

		const res = await DELETE(make_delete_event(sub.id, dev.id) as never)
		expect(res.status).toBe(204)
	})

	test("returns 404 when link does not exist", async () => {
		const sub = await sub_svc.createSubscription(VALID_CREATE)
		const dev = await dev_svc.createDevice({
			slug: "tablet",
			name: "Tablet",
			filter_criteria: DEFAULT_CRITERIA,
		})

		const res = await DELETE(make_delete_event(sub.id, dev.id) as never)
		expect(res.status).toBe(404)
	})

	test("returns 404 for unknown subscription and device ids", async () => {
		const res = await DELETE(
			make_delete_event(
				"00000000-0000-7000-8000-000000000001",
				"00000000-0000-7000-8000-000000000002",
			) as never,
		)
		expect(res.status).toBe(404)
	})
})
