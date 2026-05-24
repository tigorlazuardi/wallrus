import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * DELETE /api/v1/images/[id]/tags/[tag]
 * Remove a user tag from an image.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const id = event.params.id!
		const tag = event.params.tag!

		await runtime_ref().services.images.removeTag({ image_id: id, tag })

		return new Response(null, { status: 204 })
	} catch (err) {
		return app_error_to_response(err)
	}
}
