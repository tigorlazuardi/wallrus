import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { ToggleDeviceRequest, ToggleDeviceResponse } from "$lib/schemas/devices/ToggleDevice"
import { devices } from "$lib/server/db/schema"
import { type Constructor, to_device_dto } from "./base"

export function ToggleDevice<T extends Constructor>(Sup: T) {
	return class ToggleDevice extends Sup {
		@traced()
		async toggleDevice(req: ToggleDeviceRequest): Promise<ToggleDeviceResponse> {
			const db = this.deps.db

			const rows = await withQueryName("devices.toggle", () =>
				db
					.update(devices)
					.set({ enabled: req.enabled })
					.where(eq(devices.id, req.id))
					.returning(),
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
