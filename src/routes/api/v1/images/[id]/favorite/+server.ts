import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * POST /api/v1/images/[id]/favorite
 * Toggle favorite state for an image.
 * Body: { favorited: boolean }
 */
export const POST: RequestHandler = async (event) => {
	try {
		const id = event.params.id!

		let body: unknown
		try {
			body = await event.request.json()
		} catch {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Invalid JSON body.",
				}),
			)
		}

		if (
			typeof body !== "object" ||
			body === null ||
			typeof (body as Record<string, unknown>).favorited !== "boolean"
		) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Body must contain { favorited: boolean }.",
				}),
			)
		}

		const { favorited } = body as { favorited: boolean }

		const image = await runtime_ref().services.images.toggleFavorite({
			image_id: id,
			favorited,
		})

		return new Response(JSON.stringify(image), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
