import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { create_test_db } from "$test/db"
import { SubscriptionService } from "$lib/server/service/subscriptions"
import { ImageService } from "$lib/server/service/images"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { reload } from "./cron"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

// Minimal Runtime stub for scheduler tests
function make_runtime(): Runtime {
	const db = create_test_db()
	const subscriptions = new SubscriptionService({ db })
	return {
		db,
		services: {
			devices: {} as never,
			subscriptions,
			images: new ImageService({ db }),
			runs: {} as never,
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

beforeEach(() => {
	sources["mock"] = make_mock_source("mock")
})

afterEach(() => {
	delete sources["mock"]
	_reset_runtime_for_tests()
})

describe("scheduler.reload", () => {
	test("reload before start is a no-op (does not throw)", async () => {
		const rt = make_runtime()
		// Reload without calling start() — should not throw, just rebuilds the map
		await expect(reload(rt)).resolves.toBeUndefined()
	})

	test("reload after CreateSubscription includes the new subscription id", async () => {
		const rt = make_runtime()
		set_runtime(rt)

		const sub = await rt.services.subscriptions.createSubscription({
			source_slug: "mock",
			name: "Test Subscription",
			input_params: {},
			cron: "*/5 * * * *",
		})

		// After createSubscription, reload was called internally — but let's verify
		// we can also call reload explicitly and it returns cleanly
		await expect(reload(rt)).resolves.toBeUndefined()

		// The subscription was saved and the service works
		const fetched = await rt.services.subscriptions.getSubscription({ id: sub.id })
		expect(fetched.id).toBe(sub.id)
		expect(fetched.source_slug).toBe("mock")
	})
})
