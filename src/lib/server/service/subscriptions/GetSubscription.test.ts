import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { SubscriptionService } from "./index"
import { ImageService } from "$lib/server/service/images"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

function make_runtime(db: ReturnType<typeof create_test_db>): Runtime {
	return {
		db,
		services: {
			devices: {} as never,
			subscriptions: new SubscriptionService({ db }),
			images: new ImageService({ db }),
		},
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

describe("SubscriptionService.getSubscription", () => {
	test("returns the subscription by id", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "My Sub",
			input_params: {},
			cron: "0 * * * *",
		})

		const fetched = await svc.getSubscription({ id: created.id })
		expect(fetched.id).toBe(created.id)
		expect(fetched.name).toBe("My Sub")
		expect(fetched.source_slug).toBe("mock")
		expect(fetched.cron).toBe("0 * * * *")
		expect(fetched.enabled).toBe(true)
		expect(fetched.deleted_at).toBeNull()
	})

	test("returns a soft-deleted subscription (no filtering in getSubscription)", async () => {
		const created = await svc.createSubscription({
			source_slug: "mock",
			name: "Deleted",
			input_params: {},
			cron: "0 * * * *",
		})
		await svc.deleteSubscription({ id: created.id })

		const fetched = await svc.getSubscription({ id: created.id })
		expect(fetched.id).toBe(created.id)
		expect(fetched.deleted_at).not.toBeNull()
	})

	test("throws 404 for missing id", async () => {
		try {
			await svc.getSubscription({ id: "00000000-0000-7000-8000-000000000001" })
			throw new Error("expected to throw")
		} catch (e) {
			const err = AppError.is(e, AppError)
			expect(err).toBeDefined()
			expect(err?.status).toBe(404)
		}
	})
})
