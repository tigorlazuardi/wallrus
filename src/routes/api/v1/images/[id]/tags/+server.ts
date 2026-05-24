import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * POST /api/v1/images/[id]/tags
 * Add a user tag to an image. Idempotent — returns 200 even if the tag already exists.
 * Body: { tag: string }
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
			typeof (body as Record<string, unknown>).tag !== "string" ||
			(body as Record<string, unknown>).tag === ""
		) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Body must contain { tag: string }.",
				}),
			)
		}

		const { tag } = body as { tag: string }

		const result = await runtime_ref().services.images.addTag({ image_id: id, tag })

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
