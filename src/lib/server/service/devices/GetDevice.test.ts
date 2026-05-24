import { describe, expect, test } from "bun:test"
import { uuidv7 } from "uuidv7"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { devices } from "$lib/server/db/schema"
import { DeviceService } from "./index"

const default_criteria = { nsfw: "all" as const }

function assert_app_error(e: unknown, expected_message: string, expected_status: number): void {
	const app_err = AppError.is(e, AppError)
	expect(app_err).toBeDefined()
	expect(app_err?.message).toBe(expected_message)
	expect(app_err?.status).toBe(expected_status)
}

describe("DeviceService.getDevice", () => {
	test("returns device by id", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const id = uuidv7()
		await db.insert(devices).values({
			id,
			slug: "my-device",
			name: "My Device",
			enabled: true,
			filter_criteria: default_criteria,
			created_at: Date.now(),
		})

		const result = await svc.getDevice({ id })
		expect(result.id).toBe(id)
		expect(result.slug).toBe("my-device")
		expect(result.name).toBe("My Device")
	})

	test("returns device by slug", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const id = uuidv7()
		await db.insert(devices).values({
			id,
			slug: "slug-lookup",
			name: "Slug Device",
			enabled: true,
			filter_criteria: default_criteria,
			created_at: Date.now(),
		})

		const result = await svc.getDevice({ slug: "slug-lookup" })
		expect(result.id).toBe(id)
		expect(result.slug).toBe("slug-lookup")
	})

	test("throws not_found.device when id does not exist", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const missing_id = uuidv7()
		try {
			await svc.getDevice({ id: missing_id })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})

	test("throws not_found.device when slug does not exist", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		try {
			await svc.getDevice({ slug: "no-such-slug" })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})
})
