import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/images/[id]
 * Returns a single image by ID.
 * Query params: include_deleted (default false)
 */
export const GET: RequestHandler = async (event) => {
	try {
		const id = event.params.id!
		const include_deleted = event.url.searchParams.get("include_deleted") === "true"

		const image = await runtime_ref().services.images.getImage({ id, include_deleted })

		return new Response(JSON.stringify(image), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}

/**
 * DELETE /api/v1/images/[id]
 * Soft-deletes an image. With ?blacklist=true, blacklists the image instead.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const id = event.params.id!
		const blacklist = event.url.searchParams.get("blacklist") === "true"

		if (blacklist) {
			await runtime_ref().services.images.blacklistImage({ id })
		} else {
			await runtime_ref().services.images.softDeleteImage({ id })
		}

		return new Response(null, { status: 204 })
	} catch (err) {
		return app_error_to_response(err)
	}
}
