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

describe("SubscriptionService.createSubscription", () => {
	test("happy path — creates a subscription and returns a DTO", async () => {
		const result = await svc.createSubscription({
			source_slug: "mock",
			name: "My Subscription",
			input_params: {},
			cron: "*/5 * * * *",
		})

		expect(result.id).toBeString()
		expect(result.source_slug).toBe("mock")
		expect(result.name).toBe("My Subscription")
		expect(result.enabled).toBe(true)
		expect(result.cron).toBe("*/5 * * * *")
		expect(result.deleted_at).toBeNull()
		expect(typeof result.created_at).toBe("number")
	})

	test("sets max_items_inspected when provided", async () => {
		const result = await svc.createSubscription({
			source_slug: "mock",
			name: "Limited",
			input_params: {},
			cron: "0 * * * *",
			max_items_inspected: 100,
		})
		expect(result.max_items_inspected).toBe(100)
	})

	test("invalid cron expression throws validation.cron_invalid (400)", async () => {
		try {
			await svc.createSubscription({
				source_slug: "mock",
				name: "Bad Cron",
				input_params: {},
				cron: "not-a-cron",
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.message).toBe("validation.cron_invalid")
			expect(err?.status).toBe(400)
		}
	})

	test("unknown source slug throws validation.unknown_source (400)", async () => {
		try {
			await svc.createSubscription({
				source_slug: "nonexistent-source",
				name: "Bad Source",
				input_params: {},
				cron: "0 * * * *",
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.message).toBe("validation.unknown_source")
			expect(err?.status).toBe(400)
		}
	})

	test("invalid input_params throws validation.input_params (400)", async () => {
		// Register a source with strict schema
		sources["strict"] = {
			slug: "strict",
			display_name: "Strict Source",
			params_schema: z.object({ required_field: z.string() }),
			async *fetch() {},
		}

		try {
			await svc.createSubscription({
				source_slug: "strict",
				name: "Bad Params",
				input_params: { wrong_field: 123 },
				cron: "0 * * * *",
			})
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.message).toBe("validation.input_params")
			expect(err?.status).toBe(400)
		} finally {
			delete sources["strict"]
		}
	})

	test("created subscription is retrievable by id", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Retrievable",
			input_params: { key: "value" },
			cron: "0 0 * * *",
		})

		const fetched = await svc.getSubscription({ id: created.id })
		expect(fetched.id).toBe(created.id)
		expect(fetched.input_params).toEqual({ key: "value" })
	})
})
