import { error } from "@sveltejs/kit"
import type { PageLoad } from "./$types"
import { GetSubscriptionResponseSchema } from "$lib/schemas/subscriptions/GetSubscription"
import { ListSubscriptionRunsResponseSchema } from "$lib/schemas/runs/ListSubscriptionRuns"
import type { GetSubscriptionResponse } from "$lib/schemas/subscriptions/GetSubscription"
import type { Run } from "$lib/schemas/runs/Run"

export interface RunsPageData {
	subscription: GetSubscriptionResponse
	runs: Run[]
	total: number
	next_cursor: string | undefined
	prev_cursor: string | undefined
}

export const load: PageLoad = async ({ fetch, params, url }): Promise<RunsPageData> => {
	const next = url.searchParams.get("next") ?? undefined
	const prev = url.searchParams.get("prev") ?? undefined

	// Fetch subscription — 404 if not found
	const sub_res = await fetch(`/api/v1/subscriptions/${params.id}`)
	if (!sub_res.ok) {
		if (sub_res.status === 404) {
			error(404, "Subscription not found")
		}
		error(sub_res.status, `Failed to load subscription (${sub_res.status})`)
	}
	const subscription = GetSubscriptionResponseSchema.parse(await sub_res.json())

	// Fetch runs with cursor pagination
	let runs_query = `/api/v1/subscriptions/${params.id}/runs?limit=20`
	if (next) runs_query += `&next=${encodeURIComponent(next)}`
	else if (prev) runs_query += `&prev=${encodeURIComponent(prev)}`

	const runs_res = await fetch(runs_query)
	if (!runs_res.ok) {
		error(runs_res.status, `Failed to load runs (${runs_res.status})`)
	}
	const runs_result = ListSubscriptionRunsResponseSchema.parse(await runs_res.json())

	return {
		subscription,
		runs: runs_result.items,
		total: runs_result.total,
		next_cursor: runs_result.next_cursor,
		prev_cursor: runs_result.prev_cursor,
	}
}
