import type { RequestHandler } from "@sveltejs/kit"
import { list_sources } from "$lib/server/sources/_registry"
import { serialize_params_schema } from "$lib/server/sources/params_descriptor"
import { app_error_to_response } from "$lib/server/http/errors"

/**
 * GET /api/v1/sources
 * Returns all registered first-party source modules with their param descriptors.
 * Response: { items: [{ slug, display_name, param_descriptors }] }
 * No pagination — registry is small (MVP set: reddit + booru variants).
 */
export const GET: RequestHandler = async () => {
	try {
		const modules = list_sources()
		const items = modules.map((m) => ({
			slug: m.slug,
			display_name: m.display_name,
			param_descriptors: serialize_params_schema(m.params_schema),
		}))
		return new Response(JSON.stringify({ items }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
