import type { RequestHandler } from "@sveltejs/kit"
import { ListRunsRequestSchema } from "$lib/schemas/runs/ListRuns"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/runs
 * Returns paginated list of run_history rows.
 * Query params: next, prev, offset, limit, subscription_id, status, since, until
 */
export const GET: RequestHandler = async (event) => {
	try {
		const sp = event.url.searchParams

		const raw: Record<string, unknown> = {}

		const next = sp.get("next")
		if (next !== null) raw.next = next

		const prev = sp.get("prev")
		if (prev !== null) raw.prev = prev

		const offset = sp.get("offset")
		if (offset !== null) raw.offset = Number(offset)

		const limit = sp.get("limit")
		if (limit !== null) raw.limit = Number(limit)

		const subscription_id = sp.get("subscription_id")
		if (subscription_id !== null) raw.subscription_id = subscription_id

		const status = sp.get("status")
		if (status !== null) raw.status = status

		const since = sp.get("since")
		if (since !== null) raw.since = Number(since)

		const until = sp.get("until")
		if (until !== null) raw.until = Number(until)

		const parsed = ListRunsRequestSchema.safeParse(raw)
		if (!parsed.success) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				}),
			)
		}

		const result = await runtime_ref().services.runs.listRuns(parsed.data)

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
