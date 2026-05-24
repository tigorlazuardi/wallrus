import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type { LinkDeviceRequest, LinkDeviceResponse } from "$lib/schemas/subscriptions/LinkDevice"
import { device_subscriptions } from "$lib/server/db/schema"
import { type Constructor } from "./base"

export function LinkDevice<T extends Constructor>(Sup: T) {
	return class LinkDevice extends Sup {
		@traced()
		async linkDevice(req: LinkDeviceRequest): Promise<LinkDeviceResponse> {
			const db = this.deps.db
			const now = Date.now()

			try {
				const rows = await withQueryName("subscriptions.link_device", () =>
					db
						.insert(device_subscriptions)
						.values({
							device_id: req.device_id,
							subscription_id: req.subscription_id,
							created_at: now,
						})
						.returning(),
				)

				const row = rows[0]
				if (!row) {
					throw AppError.fail("internal.insert_failed", {
						status: 500,
						publicMessage: "Failed to link device.",
					})
				}

				return {
					subscription_id: row.subscription_id,
					device_id: row.device_id,
					created_at: row.created_at,
				}
			} catch (err) {
				if (err instanceof Error) {
					if (
						err.message.includes("UNIQUE") &&
						(err.message.toLowerCase().includes("device_id") ||
							err.message.toLowerCase().includes("device_subscriptions"))
					) {
						throw AppError.fail("validation.already_linked", {
							status: 409,
							publicMessage: "Device is already linked to this subscription.",
							fields: {
								subscription_id: req.subscription_id,
								device_id: req.device_id,
							},
						})
					}
					if (
						err.message.includes("FOREIGN KEY") ||
						err.message.includes("foreign key")
					) {
						throw AppError.fail("validation.unknown_device_or_subscription", {
							status: 404,
							publicMessage: "Device or subscription not found.",
							fields: {
								subscription_id: req.subscription_id,
								device_id: req.device_id,
							},
						})
					}
				}
				if (AppError.is(err, AppError)) throw err
				throw AppError.wrap(err, {
					status: 500,
					publicMessage: "Failed to link device.",
				})
			}
		}
	}
}
