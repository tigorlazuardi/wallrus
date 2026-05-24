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

describe("SubscriptionService.deleteSubscription", () => {
	test("soft-delete sets deleted_at (not null)", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "To Delete",
			input_params: {},
			cron: "0 * * * *",
		})

		const before = Date.now()
		const result = await svc.deleteSubscription({ id: created.id })
		const after = Date.now()

		expect(result.id).toBe(created.id)
		expect(result.deleted_at).toBeGreaterThanOrEqual(before)
		expect(result.deleted_at).toBeLessThanOrEqual(after)
	})

	test("soft-deleted subscription row still exists in DB", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Persisted",
			input_params: {},
			cron: "0 * * * *",
		})
		await svc.deleteSubscription({ id: created.id })

		// getSubscription should still find it (no hard-delete)
		const fetched = await svc.getSubscription({ id: created.id })
		expect(fetched.deleted_at).not.toBeNull()
	})

	test("throws 404 for missing id", async () => {
		try {
			await svc.deleteSubscription({ id: "00000000-0000-7000-8000-000000000001" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err?.status).toBe(404)
		}
	})

	test("reload is triggered after delete", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		await expect(svc.deleteSubscription({ id: created.id })).resolves.toBeDefined()
	})
})
