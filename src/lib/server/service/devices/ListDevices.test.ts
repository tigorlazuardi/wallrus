import { describe, expect, test } from "bun:test"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import { DeviceService } from "./index"
import { devices } from "$lib/server/db/schema"

/** Default filter criteria used across tests. */
const default_criteria = { nsfw: "all" as const }

function make_device(
	overrides: {
		id?: string
		slug?: string
		name?: string
		enabled?: boolean
		created_at?: number
	} = {},
) {
	return {
		id: overrides.id ?? uuidv7(),
		slug: overrides.slug ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		name: overrides.name ?? "Test Device",
		enabled: overrides.enabled ?? true,
		filter_criteria: default_criteria,
		created_at: overrides.created_at ?? Date.now(),
	}
}

describe("DeviceService.listDevices", () => {
	test("empty result set", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })
		const result = await svc.listDevices({ offset: 0, limit: 50 })
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
		expect(result.next_cursor).toBeUndefined()
		expect(result.prev_cursor).toBeUndefined()
	})

	test("returns all devices when unpaginated", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		await db
			.insert(devices)
			.values([make_device({ slug: "alpha" }), make_device({ slug: "beta" })])

		const result = await svc.listDevices({ offset: 0, limit: 50 })
		expect(result.items).toHaveLength(2)
		expect(result.total).toBe(2)
	})

	test("next cursor advances forward in time-ordered results", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		// Insert 3 devices with distinct created_at values (desc order: c, b, a)
		const now = Date.now()
		const a = make_device({ slug: "a", created_at: now - 2000 })
		const b = make_device({ slug: "b", created_at: now - 1000 })
		const c = make_device({ slug: "c", created_at: now })
		await db.insert(devices).values([a, b, c])

		// First page — limit 2
		const page1 = await svc.listDevices({ offset: 0, limit: 2 })
		expect(page1.items).toHaveLength(2)
		expect(page1.total).toBe(3)
		expect(page1.next_cursor).toBeDefined()
		// Order is DESC created_at: first two items should be c and b
		expect(page1.items[0]?.slug).toBe("c")
		expect(page1.items[1]?.slug).toBe("b")

		// Second page using next cursor
		const page2 = await svc.listDevices({ offset: 0, limit: 2, next: page1.next_cursor })
		expect(page2.items).toHaveLength(1)
		expect(page2.items[0]?.slug).toBe("a")
	})

	test("prev cursor returns items before anchor", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const now = Date.now()
		const a = make_device({ slug: "a", created_at: now - 2000 })
		const b = make_device({ slug: "b", created_at: now - 1000 })
		const c = make_device({ slug: "c", created_at: now })
		await db.insert(devices).values([a, b, c])

		// Get page1 to get prev_cursor from item c (oldest in desc → first item)
		const page1 = await svc.listDevices({ offset: 0, limit: 2 })
		expect(page1.prev_cursor).toBeDefined()

		// Using prev cursor should return items BEFORE the anchor (newer = c)
		// Prev cursor is anchored to rows[0] which is 'c' (newest), looking backwards = items newer than c = nothing
		const prev_page = await svc.listDevices({ offset: 0, limit: 50, prev: page1.prev_cursor })
		// Items newer than 'c' don't exist
		expect(prev_page.items).toHaveLength(0)
	})

	test("enabled filter returns only enabled devices", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		await db
			.insert(devices)
			.values([
				make_device({ slug: "enabled-1", enabled: true }),
				make_device({ slug: "disabled-1", enabled: false }),
				make_device({ slug: "enabled-2", enabled: true }),
			])

		const enabled_only = await svc.listDevices({ offset: 0, limit: 50, enabled: true })
		expect(enabled_only.items).toHaveLength(2)
		expect(enabled_only.total).toBe(2)
		expect(enabled_only.items.every((d) => d.enabled)).toBe(true)

		const disabled_only = await svc.listDevices({ offset: 0, limit: 50, enabled: false })
		expect(disabled_only.items).toHaveLength(1)
		expect(disabled_only.total).toBe(1)
		expect(disabled_only.items[0]?.slug).toBe("disabled-1")
	})
})
