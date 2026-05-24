import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { create_test_db } from "$test/db"
import { set_runtime, _reset_runtime_for_tests } from "$lib/server/runtime"
import { sources } from "$lib/server/sources/_registry"
import { SubscriptionService } from "./index"
import type { Runtime } from "$lib/server/bootstrap"
import type { SourceModule } from "$lib/server/sources/_types"

function make_runtime(db: ReturnType<typeof create_test_db>): Runtime {
	const subscriptions = new SubscriptionService({ db })
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

beforeEach(() => {
	sources["mock"] = make_mock_source("mock")
	sources["alt"] = make_mock_source("alt")
	db = create_test_db()
	svc = new SubscriptionService({ db })
	set_runtime(make_runtime(db))
})

afterEach(() => {
	delete sources["mock"]
	delete sources["alt"]
	_reset_runtime_for_tests()
})

async function create_sub(
	overrides: Partial<Parameters<SubscriptionService["createSubscription"]>[0]> = {},
) {
	return svc.createSubscription({
		source_slug: "mock",
		name: "Test Sub",
		input_params: {},
		cron: "*/5 * * * *",
		...overrides,
	})
}

describe("SubscriptionService.listSubscriptions", () => {
	test("empty list returns paginated shape", async () => {
		const result = await svc.listSubscriptions({ offset: 0, limit: 50, include_deleted: false })
		expect(result.items).toEqual([])
		expect(result.total).toBe(0)
		expect(result.next_cursor).toBeUndefined()
		expect(result.prev_cursor).toBeUndefined()
	})

	test("returns subscriptions in descending created_at order", async () => {
		const a = await create_sub({ name: "A" })
		const b = await create_sub({ name: "B" })
		const result = await svc.listSubscriptions({ offset: 0, limit: 50, include_deleted: false })
		expect(result.total).toBe(2)
		// Most recent first
		expect(result.items[0]!.id).toBe(b.id)
		expect(result.items[1]!.id).toBe(a.id)
	})

	test("enabled filter — returns only enabled subscriptions", async () => {
		const active = await create_sub({ name: "Active" })
		await svc.toggleSubscription({ id: active.id, enabled: false })
		await create_sub({ name: "Also Active" })

		const result = await svc.listSubscriptions({
			offset: 0,
			limit: 50,
			enabled: true,
			include_deleted: false,
		})
		expect(result.items.every((s) => s.enabled)).toBe(true)
		expect(result.items.length).toBe(1)
		expect(result.items[0]!.name).toBe("Also Active")
	})

	test("source_slug filter — returns only matching subscriptions", async () => {
		await create_sub({ source_slug: "mock", name: "Mock Sub" })
		await create_sub({ source_slug: "alt", name: "Alt Sub" })

		const result = await svc.listSubscriptions({
			offset: 0,
			limit: 50,
			source_slug: "mock",
			include_deleted: false,
		})
		expect(result.items.length).toBe(1)
		expect(result.items[0]!.source_slug).toBe("mock")
	})

	test("include_deleted=false (default) hides soft-deleted subscriptions", async () => {
		const sub = await create_sub({ name: "To Delete" })
		await svc.deleteSubscription({ id: sub.id })

		const result = await svc.listSubscriptions({ offset: 0, limit: 50, include_deleted: false })
		expect(result.items.find((s) => s.id === sub.id)).toBeUndefined()
		expect(result.total).toBe(0)
	})

	test("include_deleted=true returns soft-deleted subscriptions", async () => {
		const sub = await create_sub({ name: "Deleted" })
		await svc.deleteSubscription({ id: sub.id })

		const result = await svc.listSubscriptions({ offset: 0, limit: 50, include_deleted: true })
		const found = result.items.find((s) => s.id === sub.id)
		expect(found).toBeDefined()
		expect(found?.deleted_at).not.toBeNull()
	})

	test("limit and total are respected", async () => {
		await create_sub({ name: "A" })
		await create_sub({ name: "B" })
		await create_sub({ name: "C" })

		const result = await svc.listSubscriptions({ offset: 0, limit: 2, include_deleted: false })
		expect(result.items.length).toBe(2)
		expect(result.total).toBe(3)
	})
})
