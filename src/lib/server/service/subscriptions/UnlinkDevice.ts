import { and, eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	UnlinkDeviceRequest,
	UnlinkDeviceResponse,
} from "$lib/schemas/subscriptions/UnlinkDevice"
import { device_subscriptions } from "$lib/server/db/schema"
import { type Constructor } from "./base"

export function UnlinkDevice<T extends Constructor>(Sup: T) {
	return class UnlinkDevice extends Sup {
		@traced()
		async unlinkDevice(req: UnlinkDeviceRequest): Promise<UnlinkDeviceResponse> {
			const db = this.deps.db

			const rows = await withQueryName("subscriptions.unlink_device", () =>
				db
					.delete(device_subscriptions)
					.where(
						and(
							eq(device_subscriptions.subscription_id, req.subscription_id),
							eq(device_subscriptions.device_id, req.device_id),
						),
					)
					.returning(),
			)

			if (rows.length === 0) {
				throw AppError.fail("not_found.link", {
					status: 404,
					publicMessage: "Device link not found.",
					fields: {
						subscription_id: req.subscription_id,
						device_id: req.device_id,
					},
				})
			}

			return {
				subscription_id: req.subscription_id,
				device_id: req.device_id,
			}
		}
	}
}
