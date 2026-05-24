import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	DeleteSubscriptionRequest,
	DeleteSubscriptionResponse,
} from "$lib/schemas/subscriptions/DeleteSubscription"
import { subscriptions } from "$lib/server/db/schema"
import { runtime_ref } from "$lib/server/runtime"
import { reload } from "$lib/server/scheduler/cron"
import { type Constructor } from "./base"

export function DeleteSubscription<T extends Constructor>(Sup: T) {
	return class DeleteSubscription extends Sup {
		@traced()
		async deleteSubscription(
			req: DeleteSubscriptionRequest,
		): Promise<DeleteSubscriptionResponse> {
			const db = this.deps.db
			const now = Date.now()

			const rows = await withQueryName("subscriptions.delete", () =>
				db
					.update(subscriptions)
					.set({ deleted_at: now })
					.where(eq(subscriptions.id, req.id))
					.returning({ id: subscriptions.id, deleted_at: subscriptions.deleted_at }),
			)

			const row = rows[0]
			if (!row || row.deleted_at === null || row.deleted_at === undefined) {
				throw AppError.fail(`subscription not found: ${req.id}`, {
					status: 404,
					publicMessage: "Subscription not found.",
					fields: { id: req.id },
				})
			}

			await reload(runtime_ref())

			return { id: row.id, deleted_at: row.deleted_at }
		}
	}
}
