import { error } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { Subscription } from "$lib/schemas/subscriptions/Subscription"

export const load: PageServerLoad = async ({ params }) => {
	let run
	try {
		run = await runtime_ref().services.runs.getRun({ id: params.id })
	} catch (err) {
		const app_err = AppError.is(err, AppError)
		if (app_err && app_err.status === 404) {
			error(404, "Run not found")
		}
		throw err
	}

	let subscription: Pick<Subscription, "name" | "source_slug"> | undefined
	try {
		const sub = await runtime_ref().services.subscriptions.getSubscription({
			id: run.subscription_id,
		})
		subscription = { name: sub.name, source_slug: sub.source_slug }
	} catch {
		// Subscription may have been soft-deleted — display run without subscription name
	}

	return { run, subscription }
}
