import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/runs/[id]
 * Returns a single run_history row by id.
 * 200 on success, 404 if not found.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const id = event.params.id ?? ""
		const result = await runtime_ref().services.runs.getRun({ id })

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
