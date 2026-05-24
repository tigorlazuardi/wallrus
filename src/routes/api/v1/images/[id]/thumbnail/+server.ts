import type { RequestHandler } from "@sveltejs/kit"
import { runtime_ref } from "$lib/server/runtime"
import { join } from "node:path"
import { app_error_to_response } from "$lib/server/http/errors"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

/**
 * GET /api/v1/images/[id]/thumbnail
 *
 * Streams the WebP thumbnail for the given image from
 * `<data_dir>/.thumbs/<id>.webp`. Gated by the 003 auth hook.
 *
 * Returns 404 if the thumbnail file does not exist on disk.
 * Sets a long-lived immutable cache header on success.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id
		if (!id) throw AppError.fail("validation.body", { status: 400 })

		const runtime = runtime_ref()
		const thumb_path = join(runtime.env.WALLRUS_DATA_DIR, ".thumbs", `${id}.webp`)
		const file = Bun.file(thumb_path)

		if (!(await file.exists())) {
			throw AppError.fail("not_found.thumbnail", {
				status: 404,
				fields: { image_id: id },
			})
		}

		return new Response(file.stream(), {
			status: 200,
			headers: {
				"content-type": "image/webp",
				"cache-control": "private, max-age=31536000, immutable",
			},
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
