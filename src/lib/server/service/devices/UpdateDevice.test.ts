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

describe("DeviceService.updateDevice", () => {
	test("updates name only", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "update-name",
			name: "Original Name",
			filter_criteria: default_criteria,
		})

		const updated = await svc.updateDevice({ id: created.id, name: "New Name" })
		expect(updated.id).toBe(created.id)
		expect(updated.name).toBe("New Name")
		expect(updated.slug).toBe("update-name")
		expect(updated.filter_criteria).toEqual(default_criteria)
	})

	test("updates filter_criteria only", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "update-criteria",
			name: "Criteria Device",
			filter_criteria: default_criteria,
		})

		const new_criteria = { nsfw: "sfw_only" as const, min_width: 1920 }
		const updated = await svc.updateDevice({ id: created.id, filter_criteria: new_criteria })
		expect(updated.filter_criteria).toEqual(new_criteria)
		expect(updated.name).toBe("Criteria Device")
	})

	test("updates both name and filter_criteria", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "update-both",
			name: "Both Device",
			filter_criteria: default_criteria,
		})

		const new_criteria = { nsfw: "nsfw_only" as const }
		const updated = await svc.updateDevice({
			id: created.id,
			name: "Both Updated",
			filter_criteria: new_criteria,
		})
		expect(updated.name).toBe("Both Updated")
		expect(updated.filter_criteria).toEqual(new_criteria)
	})

	test("no-op update (no fields) returns current device", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "noop-update",
			name: "No-Op Device",
			filter_criteria: default_criteria,
		})

		// Send update with no fields
		const result = await svc.updateDevice({ id: created.id })
		expect(result.id).toBe(created.id)
		expect(result.name).toBe("No-Op Device")
	})

	test("throws not_found.device for missing id", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const missing_id = uuidv7()
		try {
			await svc.updateDevice({ id: missing_id, name: "Ghost" })
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "not_found.device", 404)
		}
	})
})
