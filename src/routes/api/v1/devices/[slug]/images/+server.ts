import type { RequestHandler } from "@sveltejs/kit"
import { NsfwFilterSchema } from "$lib/schemas/images/ListImages"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "$lib/server/http/errors"
import { parse_pagination } from "$lib/server/http/pagination"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/devices/[slug]/images
 * Returns paginated list of images for a specific device (resolved by slug).
 * Query params: next, prev, offset, limit, source_slug, favorited, nsfw,
 *               include_deleted, include_blacklisted, search
 */
export const GET: RequestHandler = async (event) => {
	try {
		const slug = event.params.slug!
		const sp = event.url.searchParams
		const pagination = parse_pagination(sp)

		// Resolve slug → device
		const device = await runtime_ref().services.devices.getDevice({ slug })

		// Parse optional filters (same as /api/v1/images but without device_id — that's fixed)
		const source_slug = sp.get("source_slug") ?? undefined

		let favorited: boolean | undefined
		const favorited_raw = sp.get("favorited")
		if (favorited_raw !== null) {
			if (favorited_raw === "true") favorited = true
			else if (favorited_raw === "false") favorited = false
			else {
				return app_error_to_response(
					AppError.fail("validation.favorited", {
						status: 400,
						publicMessage: "favorited must be 'true' or 'false'",
					}),
				)
			}
		}

		let nsfw: "all" | "sfw_only" | "nsfw_only" | undefined
		const nsfw_raw = sp.get("nsfw")
		if (nsfw_raw !== null) {
			const parsed = NsfwFilterSchema.safeParse(nsfw_raw)
			if (!parsed.success) {
				return app_error_to_response(
					AppError.fail("validation.nsfw", {
						status: 400,
						publicMessage: "nsfw must be 'all', 'sfw_only', or 'nsfw_only'",
					}),
				)
			}
			nsfw = parsed.data
		}

		const include_deleted = sp.get("include_deleted") === "true"
		const include_blacklisted = sp.get("include_blacklisted") === "true"
		const search = sp.get("search") ?? undefined

		const result = await runtime_ref().services.images.listDeviceImages({
			device_id: device.id,
			limit: pagination.limit,
			offset: pagination.offset,
			next: pagination.next ?? undefined,
			prev: pagination.prev ?? undefined,
			source_slug,
			favorited,
			nsfw,
			include_deleted,
			include_blacklisted,
			search,
		})

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
