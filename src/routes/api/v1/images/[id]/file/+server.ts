import type { RequestHandler } from "@sveltejs/kit"
import { runtime_ref } from "$lib/server/runtime"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { app_error_to_response } from "$lib/server/http/errors"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { device_images, devices } from "$lib/server/db/schema"

/**
 * Map image format → MIME content-type.
 */
function content_type_for_format(format: string): string {
	switch (format) {
		case "jpg":
			return "image/jpeg"
		case "png":
			return "image/png"
		case "webp":
			return "image/webp"
		case "avif":
			return "image/avif"
		default:
			return "application/octet-stream"
	}
}

/**
 * GET /api/v1/images/[id]/file
 *
 * Streams the original image file for the given image ID.
 * Resolves the on-disk path via the device_images fan-out table:
 *   <data_dir>/<device_slug>/<source_slug>-<filename>.<ext>
 *
 * Returns 404 if:
 * - The image row does not exist.
 * - No device_images fan-out rows exist for this image (data integrity
 *   issue or image predates slice 009 fan-out).
 * - The resolved file does not exist on disk.
 *
 * Gated by the 003 auth hook. Does NOT rate-limit — image grids hit
 * this endpoint many times in parallel.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id
		if (!id) throw AppError.fail("validation.body", { status: 400 })

		const runtime = runtime_ref()
		const db = runtime.db

		// Fetch the image row (throws 404 if not found or soft-deleted).
		const image = await runtime.services.images.getImage({ id })

		// Find the first device_images row with its device for path resolution.
		const link = await db
			.select({
				on_disk_path: device_images.on_disk_path,
				device_slug: devices.slug,
			})
			.from(device_images)
			.innerJoin(devices, eq(devices.id, device_images.device_id))
			.where(eq(device_images.image_id, id))
			.limit(1)
			.then((rows) => rows[0])

		if (!link) {
			throw AppError.fail("not_found.file", {
				status: 404,
				fields: {
					image_id: id,
					reason: "image has no on-disk fan-out",
				},
			})
		}

		// Use the stored on_disk_path if it's absolute; otherwise construct from
		// data_dir + device_slug + source_slug-filename.ext.
		let file_path: string
		if (link.on_disk_path.startsWith("/")) {
			file_path = link.on_disk_path
		} else {
			const ext = image.format
			file_path = join(
				runtime.env.WALLRUS_DATA_DIR,
				link.device_slug,
				`${image.source_slug}-${image.filename}.${ext}`,
			)
		}

		const file = Bun.file(file_path)

		if (!(await file.exists())) {
			throw AppError.fail("not_found.file", {
				status: 404,
				fields: { image_id: id, path: file_path },
			})
		}

		return new Response(file.stream(), {
			status: 200,
			headers: {
				"content-type": content_type_for_format(image.format),
				"cache-control": "no-cache",
				"content-disposition": "inline",
			},
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
