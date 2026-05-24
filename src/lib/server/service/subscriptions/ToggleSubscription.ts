import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	ToggleSubscriptionRequest,
	ToggleSubscriptionResponse,
} from "$lib/schemas/subscriptions/ToggleSubscription"
import { subscriptions } from "$lib/server/db/schema"
import { runtime_ref } from "$lib/server/runtime"
import { reload } from "$lib/server/scheduler/cron"
import { type Constructor, to_subscription_dto } from "./base"

export function ToggleSubscription<T extends Constructor>(Sup: T) {
	return class ToggleSubscription extends Sup {
		@traced()
		async toggleSubscription(
			req: ToggleSubscriptionRequest,
		): Promise<ToggleSubscriptionResponse> {
			const db = this.deps.db

			const rows = await withQueryName("subscriptions.toggle", () =>
				db
					.update(subscriptions)
					.set({ enabled: req.enabled })
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
