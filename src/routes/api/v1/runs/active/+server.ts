import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/runs/active
 * Returns all currently running runs (status = 'running'), capped at 100.
 */
export const GET: RequestHandler = async () => {
	try {
		const result = await runtime_ref().services.runs.getActiveRuns({})

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
