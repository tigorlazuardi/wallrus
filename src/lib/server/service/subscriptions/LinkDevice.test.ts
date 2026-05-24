import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { SubscriptionService } from "./index"
import { DeviceService } from "$lib/server/service/devices"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

function make_runtime(
	db: ReturnType<typeof create_test_db>,
	subscriptions: SubscriptionService,
): Runtime {
	return {
		db,
		services: { devices: {} as never, subscriptions },
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

describe("SubscriptionService.linkDevice", () => {
	test("happy path — links a device to a subscription", async () => {
		const sub = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		const device = await devices_svc.createDevice({
			slug: "dev-1",
			name: "Device 1",
			filter_criteria: { nsfw: "all" },
		})

		const link = await svc.linkDevice({
			subscription_id: sub.id,
			device_id: device.id,
		})

		expect(link.subscription_id).toBe(sub.id)
		expect(link.device_id).toBe(device.id)
		expect(typeof link.created_at).toBe("number")
	})

	test("duplicate link throws validation.already_linked (409)", async () => {
		const sub = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		const device = await devices_svc.createDevice({
			slug: "dev-dup",
			name: "Device Dup",
			filter_criteria: { nsfw: "all" },
		})

		await svc.linkDevice({ subscription_id: sub.id, device_id: device.id })

		try {
			await svc.linkDevice({ subscription_id: sub.id, device_id: device.id })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.message).toBe("validation.already_linked")
			expect(err?.status).toBe(409)
		}
	})
})
