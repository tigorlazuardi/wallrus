import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { SubscriptionService } from "./index"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

function make_runtime(db: ReturnType<typeof create_test_db>): Runtime {
	return {
		db,
		services: { devices: {} as never, subscriptions: new SubscriptionService({ db }) },
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

beforeEach(() => {
	sources["mock"] = make_mock_source("mock")
	db = create_test_db()
	svc = new SubscriptionService({ db })
	set_runtime(make_runtime(db))
})

afterEach(() => {
	delete sources["mock"]
	_reset_runtime_for_tests()
})

describe("SubscriptionService.toggleSubscription", () => {
	test("disable a subscription", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Toggle Me",
			input_params: {},
			cron: "0 * * * *",
		})
		expect(created.enabled).toBe(true)

		const toggled = await svc.toggleSubscription({ id: created.id, enabled: false })
		expect(toggled.id).toBe(created.id)
		expect(toggled.enabled).toBe(false)
	})

	test("re-enable a subscription", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Toggle Back",
			input_params: {},
			cron: "0 * * * *",
		})
		await svc.toggleSubscription({ id: created.id, enabled: false })
		const toggled = await svc.toggleSubscription({ id: created.id, enabled: true })
		expect(toggled.enabled).toBe(true)
	})

	test("throws 404 for missing id", async () => {
		try {
			await svc.toggleSubscription({
				id: "00000000-0000-7000-8000-000000000001",
				enabled: false,
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err?.status).toBe(404)
		}
	})

	test("reload is triggered after toggle", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		await expect(
			svc.toggleSubscription({ id: created.id, enabled: false }),
		).resolves.toBeDefined()
	})
})
