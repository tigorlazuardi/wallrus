import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { create_test_db } from "$test/db"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { SubscriptionService } from "./index"
import { DeviceService } from "$lib/server/service/devices"
import { ImageService } from "$lib/server/service/images"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

function make_runtime(
	db: ReturnType<typeof create_test_db>,
	subscriptions: SubscriptionService,
): Runtime {
	return {
		db,
		services: { devices: {} as never, subscriptions, images: new ImageService({ db }) },
		env: {} as never,
		sdk: {} as never,
	}
}

function make_mock_source(slug: string): SourceModule {
	return {
		slug,
		display_name: `Mock: ${slug}`,
		params_schema: z.object({}).passthrough(),
		async *fetch() {},
	}
}

let db: ReturnType<typeof create_test_db>
let svc: SubscriptionService
let devices_svc: DeviceService

beforeEach(() => {
	sources["mock"] = make_mock_source("mock")
	db = create_test_db()
	svc = new SubscriptionService({ db })
	devices_svc = new DeviceService({ db })
	set_runtime(make_runtime(db, svc))
})

afterEach(() => {
	delete sources["mock"]
	_reset_runtime_for_tests()
})

describe("SubscriptionService.listSubscriptionDevices", () => {
	test("empty list returns paginated shape", async () => {
		const sub = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})

		const result = await svc.listSubscriptionDevices({
			subscription_id: sub.id,
			offset: 0,
			limit: 50,
		})
		expect(result.items).toEqual([])
		expect(result.total).toBe(0)
	})

	test("returns linked devices", async () => {
		const sub = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		const device1 = await devices_svc.createDevice({
			slug: "dev-1",
			name: "Device 1",
			filter_criteria: { nsfw: "all" },
		})
		const device2 = await devices_svc.createDevice({
			slug: "dev-2",
			name: "Device 2",
			filter_criteria: { nsfw: "all" },
		})

		await svc.linkDevice({ subscription_id: sub.id, device_id: device1.id })
		await svc.linkDevice({ subscription_id: sub.id, device_id: device2.id })

		const result = await svc.listSubscriptionDevices({
			subscription_id: sub.id,
			offset: 0,
			limit: 50,
		})
		expect(result.total).toBe(2)
		expect(result.items.length).toBe(2)
		const ids = result.items.map((d) => d.id)
		expect(ids).toContain(device1.id)
		expect(ids).toContain(device2.id)
	})

	test("does not return devices linked to OTHER subscriptions", async () => {
		const sub1 = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub1",
			input_params: {},
			cron: "0 * * * *",
		})
		const sub2 = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub2",
			input_params: {},
			cron: "0 * * * *",
		})
		const device = await devices_svc.createDevice({
			slug: "only-sub2",
			name: "Only Sub2 Device",
			filter_criteria: { nsfw: "all" },
		})

		await svc.linkDevice({ subscription_id: sub2.id, device_id: device.id })

		const result = await svc.listSubscriptionDevices({
			subscription_id: sub1.id,
			offset: 0,
			limit: 50,
		})
		expect(result.items).toEqual([])
		expect(result.total).toBe(0)
	})
})
