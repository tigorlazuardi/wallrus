import { error } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

export const load: PageServerLoad = async ({ params, url }) => {
	const next = url.searchParams.get("next") ?? undefined
	const prev = url.searchParams.get("prev") ?? undefined
	const limit = 20

	let subscription
	try {
		subscription = await runtime_ref().services.subscriptions.getSubscription({ id: params.id })
	} catch (err) {
		const app_err = AppError.is(err, AppError)
		if (app_err && app_err.status === 404) {
			error(404, "Subscription not found")
		}
		throw err
	}

	const runs_result = await runtime_ref().services.runs.listSubscriptionRuns({
		subscription_id: params.id,
		limit,
		offset: 0,
		next,
		prev,
	})

	return {
		subscription,
		runs: runs_result.items,
		total: runs_result.total,
		next_cursor: runs_result.next_cursor,
		prev_cursor: runs_result.prev_cursor,
	}
}
