import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * POST /api/v1/images/[id]/restore
 * Restore a soft-deleted image. Returns 400 if the image is blacklisted.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const id = event.params.id!

		const image = await runtime_ref().services.images.restoreImage({ id })

		return new Response(JSON.stringify(image), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
