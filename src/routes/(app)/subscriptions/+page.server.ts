import type { PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"

export const load: PageServerLoad = async ({ url }) => {
	const include_deleted = url.searchParams.get("include_deleted") === "true"

	const result = await runtime_ref().services.subscriptions.listSubscriptions({
		limit: 100,
		offset: 0,
		include_deleted,
	})

	return {
		subscriptions: result.items,
		total: result.total,
		include_deleted,
	}
}
