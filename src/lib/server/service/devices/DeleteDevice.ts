import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { DeleteDeviceRequest, DeleteDeviceResponse } from "$lib/schemas/devices/DeleteDevice"
import { devices } from "$lib/server/db/schema"
import { type Constructor } from "./base"

export function DeleteDevice<T extends Constructor>(Sup: T) {
	return class DeleteDevice extends Sup {
		@traced()
		async deleteDevice(req: DeleteDeviceRequest): Promise<DeleteDeviceResponse> {
			const db = this.deps.db

			// Hard delete — FK CASCADE takes care of device_subscriptions + device_images
			const rows = await withQueryName("devices.delete", () =>
				db.delete(devices).where(eq(devices.id, req.id)).returning({ id: devices.id }),
			)

			if (rows.length === 0) {
				throw AppError.fail("not_found.device", {
					status: 404,
					publicMessage: "Device not found.",
					fields: { device_id: req.id },
				})
			}
		}
	}
}
