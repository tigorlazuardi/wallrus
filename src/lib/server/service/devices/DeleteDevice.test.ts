import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { uuidv7 } from "uuidv7"
import { eq } from "drizzle-orm"
import { create_test_db } from "$test/db"
import { devices, device_subscriptions, subscriptions } from "$lib/server/db/schema"
import { DeviceService } from "./index"

const default_criteria = { nsfw: "all" as const }

function assert_app_error(e: unknown, expected_message: string, expected_status: number): void {
	const app_err = AppError.is(e, AppError)
	expect(app_err).toBeDefined()
	expect(app_err?.message).toBe(expected_message)
	expect(app_err?.status).toBe(expected_status)
}

describe("DeviceService.deleteDevice", () => {
	test("happy path — deletes an existing device", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "to-delete",
			name: "To Delete",
			filter_criteria: default_criteria,
		})

		// Should not throw
		await svc.deleteDevice({ id: created.id })

		// Verify the device is gone
		try {
			await svc.getDevice({ id: created.id })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})

	test("throws not_found.device for missing id", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		try {
			await svc.deleteDevice({ id: uuidv7() })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})

	test("cascade clears device_subscriptions on delete", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		// Create a device
		const created = await svc.createDevice({
			slug: "cascade-test",
			name: "Cascade Test",
			filter_criteria: default_criteria,
		})

		// Create a subscription (FK required for device_subscriptions)
		const sub_id = uuidv7()
		await db.insert(subscriptions).values({
			id: sub_id,
			source_slug: "test-source",
			name: "Test Sub",
			input_params: { q: "nature" },
			cron: "0 * * * *",
			enabled: true,
			created_at: Date.now(),
		})

		// Link device ↔ subscription
		await db.insert(device_subscriptions).values({
			device_id: created.id,
			subscription_id: sub_id,
			created_at: Date.now(),
		})

		// Verify the junction row exists
		const before = await db
			.select()
			.from(device_subscriptions)
			.where(eq(device_subscriptions.device_id, created.id))
		expect(before).toHaveLength(1)

		// Delete the device
		await svc.deleteDevice({ id: created.id })

		// Verify cascade cleared the junction row
		const after = await db
			.select()
			.from(device_subscriptions)
			.where(eq(device_subscriptions.device_id, created.id))
		expect(after).toHaveLength(0)

		// Subscription itself must still exist (NO ACTION on that FK)
		const sub_row = await db.query.subscriptions.findFirst({
			where: eq(subscriptions.id, sub_id),
		})
		expect(sub_row).toBeDefined()
	})

	test("does not affect other devices", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		await db.insert(devices).values([
			{
				id: uuidv7(),
				slug: "keep-me",
				name: "Keep Me",
				enabled: true,
				filter_criteria: default_criteria,
				created_at: Date.now(),
			},
		])

		const to_delete = await svc.createDevice({
			slug: "delete-me",
			name: "Delete Me",
			filter_criteria: default_criteria,
		})

		await svc.deleteDevice({ id: to_delete.id })

		const remaining = await svc.listDevices({ offset: 0, limit: 50 })
		expect(remaining.items).toHaveLength(1)
		expect(remaining.items[0]?.slug).toBe("keep-me")
	})
})
