import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { create_test_db } from "$test/db"
import { DeviceService } from "./index"

const default_criteria = { nsfw: "all" as const }

function assert_app_error(e: unknown, expected_message: string, expected_status: number): void {
	const app_err = AppError.is(e, AppError)
	expect(app_err).toBeDefined()
	expect(app_err?.message).toBe(expected_message)
	expect(app_err?.status).toBe(expected_status)
}

describe("DeviceService.createDevice", () => {
	test("happy path — creates a device and returns a DTO", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const result = await svc.createDevice({
			slug: "my-device",
			name: "My Device",
			filter_criteria: default_criteria,
		})

		expect(result.id).toBeString()
		expect(result.slug).toBe("my-device")
		expect(result.name).toBe("My Device")
		expect(result.enabled).toBe(true)
		expect(result.filter_criteria).toEqual(default_criteria)
		expect(typeof result.created_at).toBe("number")
	})

	test("slug collision throws validation.slug_taken (409)", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		await svc.createDevice({
			slug: "taken-slug",
			name: "First",
			filter_criteria: default_criteria,
		})

		try {
			await svc.createDevice({
				slug: "taken-slug",
				name: "Second",
				filter_criteria: default_criteria,
			})
			throw new Error("expected to throw")
		} catch (e) {
			assert_app_error(e, "validation.slug_taken", 409)
		}
	})

	test("created device is retrievable by id", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const created = await svc.createDevice({
			slug: "retrievable",
			name: "Retrievable Device",
			filter_criteria: default_criteria,
		})

		const fetched = await svc.getDevice({ id: created.id })
		expect(fetched.id).toBe(created.id)
		expect(fetched.slug).toBe("retrievable")
	})

	test("creates device with rich filter criteria", async () => {
		const db = create_test_db()
		const svc = new DeviceService({ db })

		const criteria = {
			nsfw: "sfw_only" as const,
			min_width: 1920,
			min_height: 1080,
			formats: ["jpg", "png"] as Array<"jpg" | "png" | "webp" | "avif">,
		}

		const result = await svc.createDevice({
			slug: "rich-filter",
			name: "Rich Filter Device",
			filter_criteria: criteria,
		})

		expect(result.filter_criteria).toEqual(criteria)
	})
})
