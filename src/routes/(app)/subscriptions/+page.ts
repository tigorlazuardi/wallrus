import type { PageLoad } from "./$types"
import { ListSubscriptionsResponseSchema } from "$lib/schemas/subscriptions/ListSubscriptions"
import type { ListSubscriptionsResponse } from "$lib/schemas/subscriptions/ListSubscriptions"

export interface SubscriptionsPageData {
	subscriptions: ListSubscriptionsResponse | null
	include_deleted: boolean
	error?: string
}

export const load: PageLoad = async ({ fetch, url }): Promise<SubscriptionsPageData> => {
	const include_deleted = url.searchParams.get("include_deleted") === "true"

	const query = `?limit=100${include_deleted ? "&include_deleted=true" : ""}`
	const res = await fetch(`/api/v1/subscriptions${query}`)

	if (!res.ok) {
		return {
			subscriptions: null,
			include_deleted,
			error: `Failed to load subscriptions (${res.status})`,
		}
	}

	const subscriptions = ListSubscriptionsResponseSchema.parse(await res.json())
	return { subscriptions, include_deleted }
}
