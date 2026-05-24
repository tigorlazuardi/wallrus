import type { RequestHandler } from "@sveltejs/kit"
import { list_sources } from "$lib/server/sources/_registry"
import { app_error_to_response } from "$lib/server/http/errors"

/**
 * GET /api/v1/sources
 * Returns all registered first-party source modules.
 * Response: { items: [{ slug, display_name }] }
 * No pagination — registry is small (MVP set: reddit + booru variants).
 */
export const GET: RequestHandler = async () => {
	try {
		const modules = list_sources()
		const items = modules.map((m) => ({
			slug: m.slug,
			display_name: m.display_name,
		}))
		return new Response(JSON.stringify({ items }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
