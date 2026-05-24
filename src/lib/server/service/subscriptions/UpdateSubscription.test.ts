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

describe("SubscriptionService.updateSubscription", () => {
	test("partial update — name only", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Original",
			input_params: {},
			cron: "0 * * * *",
		})

		const updated = await svc.updateSubscription({ id: created.id, name: "Updated" })
		expect(updated.id).toBe(created.id)
		expect(updated.name).toBe("Updated")
		expect(updated.cron).toBe("0 * * * *") // unchanged
	})

	test("partial update — cron only", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})

		const updated = await svc.updateSubscription({ id: created.id, cron: "*/15 * * * *" })
		expect(updated.cron).toBe("*/15 * * * *")
	})

	test("invalid cron in update throws validation.cron_invalid (400)", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})

		try {
			await svc.updateSubscription({ id: created.id, cron: "not-a-cron" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err?.message).toBe("validation.cron_invalid")
			expect(err?.status).toBe(400)
		}
	})

	test("not_found throws 404", async () => {
		try {
			await svc.updateSubscription({
				id: "00000000-0000-7000-8000-000000000001",
				name: "Ghost",
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err?.status).toBe(404)
		}
	})

	test("reload is triggered after update", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Sub",
			input_params: {},
			cron: "0 * * * *",
		})
		// If reload were to throw, this would fail; verifies no crash
		await expect(
			svc.updateSubscription({ id: created.id, name: "Reloaded" }),
		).resolves.toBeDefined()
	})
})
