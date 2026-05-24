import type { PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import type { Subscription } from "$lib/schemas/subscriptions/Subscription"

export const load: PageServerLoad = async ({ url }) => {
	const next = url.searchParams.get("next") ?? undefined
	const prev = url.searchParams.get("prev") ?? undefined
	const limit = 20

	const [runs_result, subs_result] = await Promise.all([
		runtime_ref().services.runs.listRuns({ limit, offset: 0, next, prev }),
		runtime_ref().services.subscriptions.listSubscriptions({
			limit: 200,
			offset: 0,
			include_deleted: true,
		}),
	])

	// Build a lookup map from subscription_id -> { name, source_slug }
	const subscription_map: Record<string, Pick<Subscription, "name" | "source_slug">> = {}
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
