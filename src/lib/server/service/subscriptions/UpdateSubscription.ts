import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { Cron } from "croner"
import type {
	UpdateSubscriptionRequest,
	UpdateSubscriptionResponse,
} from "$lib/schemas/subscriptions/UpdateSubscription"
import { subscriptions } from "$lib/server/db/schema"
import { runtime_ref } from "$lib/server/runtime"
import { reload } from "$lib/server/scheduler/cron"
import { type Constructor, to_subscription_dto } from "./base"

export function UpdateSubscription<T extends Constructor>(Sup: T) {
	return class UpdateSubscription extends Sup {
		@traced()
		async updateSubscription(
			req: UpdateSubscriptionRequest,
		): Promise<UpdateSubscriptionResponse> {
			const db = this.deps.db

			// Validate cron if provided
			if (req.cron !== undefined) {
				try {
					new Cron(req.cron, { paused: true })
				} catch (err) {
					throw AppError.fail("validation.cron_invalid", {
						status: 400,
						publicMessage: `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`,
						fields: { cron: req.cron },
					})
				}
			}

			// Build partial update — only include provided fields
			const updates: Partial<typeof subscriptions.$inferInsert> = {}
			if (req.name !== undefined) updates.name = req.name
			if (req.input_params !== undefined) updates.input_params = req.input_params
			if (req.cron !== undefined) updates.cron = req.cron
			if (req.max_items_inspected !== undefined)
				updates.max_items_inspected = req.max_items_inspected

			if (Object.keys(updates).length === 0) {
				// No-op: just return current state
				const rows = await withQueryName("subscriptions.get_for_update", () =>
					db.select().from(subscriptions).where(eq(subscriptions.id, req.id)).limit(1),
				)
				const row = rows[0]
				if (!row) {
					throw AppError.fail(`subscription not found: ${req.id}`, {
						status: 404,
						publicMessage: "Subscription not found.",
						fields: { id: req.id },
					})
				}
				return to_subscription_dto(row)
			}

			const rows = await withQueryName("subscriptions.update", () =>
				db
					.update(subscriptions)
					.set(updates)
					.where(eq(subscriptions.id, req.id))
					.returning(),
			)

			const row = rows[0]
			if (!row) {
				throw AppError.fail(`subscription not found: ${req.id}`, {
					status: 404,
					publicMessage: "Subscription not found.",
					fields: { id: req.id },
				})
			}

			await reload(runtime_ref())

			return to_subscription_dto(row)
		}
	}
}
