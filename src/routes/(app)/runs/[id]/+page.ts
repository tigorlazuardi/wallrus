import { error } from "@sveltejs/kit"
import type { PageLoad } from "./$types"
import { GetRunResponseSchema } from "$lib/schemas/runs/GetRun"
import { GetSubscriptionResponseSchema } from "$lib/schemas/subscriptions/GetSubscription"
import type { GetRunResponse } from "$lib/schemas/runs/GetRun"
import type { GetSubscriptionResponse } from "$lib/schemas/subscriptions/GetSubscription"

export interface RunDetailPageData {
	run: GetRunResponse
	subscription: Pick<GetSubscriptionResponse, "name" | "source_slug"> | undefined
}

export const load: PageLoad = async ({ fetch, params }): Promise<RunDetailPageData> => {
	const run_res = await fetch(`/api/v1/runs/${params.id}`)
	if (!run_res.ok) {
		if (run_res.status === 404) {
			error(404, "Run not found")
		}
		error(run_res.status, `Failed to load run (${run_res.status})`)
	}
	const run = GetRunResponseSchema.parse(await run_res.json())

	let subscription: Pick<GetSubscriptionResponse, "name" | "source_slug"> | undefined
	try {
		const sub_res = await fetch(`/api/v1/subscriptions/${run.subscription_id}`)
		if (sub_res.ok) {
			const sub = GetSubscriptionResponseSchema.parse(await sub_res.json())
			subscription = { name: sub.name, source_slug: sub.source_slug }
		}
		// If not ok (e.g. 404 for soft-deleted subscription), leave subscription undefined
	} catch {
		// Network or parse error — display run without subscription name
	}

	return { run, subscription }
}
