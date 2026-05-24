import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { uuidv7 } from "uuidv7"
import type { CreateDeviceRequest, CreateDeviceResponse } from "$lib/schemas/devices/CreateDevice"
import { devices } from "$lib/server/db/schema"
import { type Constructor, to_device_dto } from "./base"

export function CreateDevice<T extends Constructor>(Sup: T) {
	return class CreateDevice extends Sup {
		@traced()
		async createDevice(req: CreateDeviceRequest): Promise<CreateDeviceResponse> {
			const db = this.deps.db
			const now = Date.now()
			const id = uuidv7()

			try {
				const rows = await db
					.insert(devices)
					.values({
						id,
						slug: req.slug,
						name: req.name,
						enabled: true,
						filter_criteria: req.filter_criteria,
						created_at: now,
					})
					.returning()

				const row = rows[0]
				if (!row) {
					throw AppError.fail("internal.insert_failed", {
						status: 500,
						publicMessage: "Failed to create device.",
					})
				}

				return to_device_dto(row)
			} catch (err) {
				// Detect SQLite UNIQUE constraint violation on slug
				if (
					err instanceof Error &&
					err.message.includes("UNIQUE") &&
					err.message.toLowerCase().includes("slug")
				) {
					throw AppError.fail("validation.slug_taken", {
						status: 409,
						publicMessage: `A device with slug "${req.slug}" already exists.`,
						fields: { slug: req.slug },
					})
				}
				// Re-throw AppErrors as-is
				if (AppError.is(err, AppError)) throw err
				throw AppError.wrap(err, {
					status: 500,
					publicMessage: "Failed to create device.",
				})
			}
		}
	}
}
