import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { GetDeviceRequest, GetDeviceResponse } from "$lib/schemas/devices/GetDevice"
import { devices } from "$lib/server/db/schema"
import { type Constructor, to_device_dto } from "./base"

// UUID pattern: 8-4-4-4-12 hex chars with dashes
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function GetDevice<T extends Constructor>(Sup: T) {
	return class GetDevice extends Sup {
		@traced()
		async getDevice(req: GetDeviceRequest): Promise<GetDeviceResponse> {
			const db = this.deps.db

			let row: typeof devices.$inferSelect | undefined

			if ("id" in req) {
				row = await withQueryName("devices.get_by_id", () =>
					db.query.devices.findFirst({ where: eq(devices.id, req.id) }),
				)
			} else {
				// Slug lookup — COLLATE NOCASE index handles case-insensitivity
				row = await withQueryName("devices.get_by_slug", () =>
					db.query.devices.findFirst({ where: eq(devices.slug, req.slug) }),
				)
			}

			if (!row) {
				const identifier = "id" in req ? req.id : req.slug
				throw AppError.fail("not_found.device", {
					status: 404,
					publicMessage: "Device not found.",
					fields: { identifier },
				})
			}

			return to_device_dto(row)
		}
	}
}

export { UUID_PATTERN }
