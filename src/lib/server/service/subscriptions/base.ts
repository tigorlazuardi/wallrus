/**
 * SubscriptionServiceBase — the root class extended by all subscription operation mixins.
 */
import type { Subscription as SubscriptionRow } from "$lib/server/db/schema"
import type { Subscription } from "$lib/schemas/subscriptions/Subscription"
import { Base, type Constructor, type Dependencies } from "../base"

export { Base, type Constructor, type Dependencies }

/** Convert a raw Drizzle `subscriptions` row to a Subscription DTO. */
export function to_subscription_dto(row: SubscriptionRow): Subscription {
	return {
		id: row.id,
		source_slug: row.source_slug,
		name: row.name,
		input_params: row.input_params,
		cron: row.cron,
		enabled: row.enabled,
		max_items_inspected: row.max_items_inspected ?? null,
		created_at: row.created_at,
		deleted_at: row.deleted_at ?? null,
	}
}
