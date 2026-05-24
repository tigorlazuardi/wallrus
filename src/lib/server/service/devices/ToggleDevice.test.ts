import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import { DeviceService } from "./index"

const default_criteria = { nsfw: "all" as const }

function assert_app_error(e: unknown, expected_message: string, expected_status: number): void {
	const app_err = AppError.is(e, AppError)
	expect(app_err).toBeDefined()
	expect(app_err?.message).toBe(expected_message)
	expect(app_err?.status).toBe(expected_status)
}

describe("DeviceService.toggleDevice", () => {
	test("disables an enabled device", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "toggle-off",
			name: "Toggle Off",
			filter_criteria: default_criteria,
		})

		expect(created.enabled).toBe(true)

		const result = await svc.toggleDevice({ id: created.id, enabled: false })
		expect(result.id).toBe(created.id)
		expect(result.enabled).toBe(false)
	})

	test("enables a disabled device", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "toggle-on",
			name: "Toggle On",
			filter_criteria: default_criteria,
		})

		// Disable first
		await svc.toggleDevice({ id: created.id, enabled: false })

		// Now enable
		const result = await svc.toggleDevice({ id: created.id, enabled: true })
		expect(result.enabled).toBe(true)
	})

	test("idempotent — toggling to the same state returns the device unchanged", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "idempotent-toggle",
			name: "Idempotent Toggle",
			filter_criteria: default_criteria,
		})

		expect(created.enabled).toBe(true)

		// Toggle to the same value
		const result = await svc.toggleDevice({ id: created.id, enabled: true })
		expect(result.enabled).toBe(true)
		expect(result.id).toBe(created.id)
	})

	test("throws not_found.device for missing id", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		try {
			await svc.toggleDevice({ id: uuidv7(), enabled: false })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})
})
