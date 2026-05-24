import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { UpdateDeviceRequest, UpdateDeviceResponse } from "$lib/schemas/devices/UpdateDevice"
import { devices } from "$lib/server/db/schema"
import { type Constructor, to_device_dto } from "./base"

export function UpdateDevice<T extends Constructor>(Sup: T) {
	return class UpdateDevice extends Sup {
		@traced()
		async updateDevice(req: UpdateDeviceRequest): Promise<UpdateDeviceResponse> {
			const db = this.deps.db

			// Build the set object with only provided fields
			const set_values: Partial<typeof devices.$inferInsert> = {}
			if (req.name !== undefined) set_values.name = req.name
			if (req.filter_criteria !== undefined) set_values.filter_criteria = req.filter_criteria

			if (Object.keys(set_values).length === 0) {
				// Nothing to update — fetch and return current row
				const current = await db.query.devices.findFirst({ where: eq(devices.id, req.id) })
				if (!current) {
					throw AppError.fail("not_found.device", {
						status: 404,
						publicMessage: "Device not found.",
						fields: { device_id: req.id },
					})
				}
				return to_device_dto(current)
			}

			const rows = await withQueryName("devices.update", () =>
				db.update(devices).set(set_values).where(eq(devices.id, req.id)).returning(),
			)

			if (rows.length === 0) {
				throw AppError.fail("not_found.device", {
					status: 404,
					publicMessage: "Device not found.",
					fields: { device_id: req.id },
				})
			}

			const row = rows[0]
			if (!row) {
				throw AppError.fail("not_found.device", {
					status: 404,
					publicMessage: "Device not found.",
					fields: { device_id: req.id },
				})
			}
			return to_device_dto(row)
		}
	}
}
