import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	GetSubscriptionRequest,
	GetSubscriptionResponse,
} from "$lib/schemas/subscriptions/GetSubscription"
import { subscriptions } from "$lib/server/db/schema"
import { type Constructor, to_subscription_dto } from "./base"

export function GetSubscription<T extends Constructor>(Sup: T) {
	return class GetSubscription extends Sup {
		@traced()
		async getSubscription(req: GetSubscriptionRequest): Promise<GetSubscriptionResponse> {
			const db = this.deps.db

			const rows = await withQueryName("subscriptions.get", () =>
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
	}
}
