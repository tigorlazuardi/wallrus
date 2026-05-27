import { error } from "@sveltejs/kit"
import type { PageLoad } from "./$types"
import { ListRunsResponseSchema } from "$lib/schemas/runs/ListRuns"
import { ListSubscriptionsResponseSchema } from "$lib/schemas/subscriptions/ListSubscriptions"
import type { Run } from "$lib/schemas/runs/Run"

export interface RunsListPageData {
	runs: Run[]
	total: number
	next_cursor: string | undefined
	prev_cursor: string | undefined
	subscription_map: Record<string, { name: string; source_slug: string }>
}

export const load: PageLoad = async ({ fetch, url }): Promise<RunsListPageData> => {
	const next = url.searchParams.get("next") ?? undefined
	const prev = url.searchParams.get("prev") ?? undefined

	let runs_query = "/api/v1/runs?limit=20"
	if (next) runs_query += `&next=${encodeURIComponent(next)}`
	else if (prev) runs_query += `&prev=${encodeURIComponent(prev)}`

	const [runs_res, subs_res] = await Promise.all([
		fetch(runs_query),
		fetch("/api/v1/subscriptions?limit=200&include_deleted=true"),
	])

	if (!runs_res.ok) {
		error(runs_res.status, `Failed to load runs (${runs_res.status})`)
	}
	if (!subs_res.ok) {
		error(subs_res.status, `Failed to load subscriptions (${subs_res.status})`)
	}

	const runs_result = ListRunsResponseSchema.parse(await runs_res.json())
	const subs_result = ListSubscriptionsResponseSchema.parse(await subs_res.json())

	const subscription_map: Record<string, { name: string; source_slug: string }> = {}
	for (const sub of subs_result.items) {
		subscription_map[sub.id] = { name: sub.name, source_slug: sub.source_slug }
	}

	return {
		runs: runs_result.items,
		total: runs_result.total,
		next_cursor: runs_result.next_cursor,
		prev_cursor: runs_result.prev_cursor,
		subscription_map,
	}
}
