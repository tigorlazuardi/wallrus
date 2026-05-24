import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { UpdateDeviceRequestSchema } from "$lib/schemas/devices/UpdateDevice"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"
import { UUID_PATTERN } from "$lib/server/service/devices/GetDevice"

/**
 * Resolve the path param to a device id.
 * If the param matches UUID_PATTERN, treat as id directly.
 * Otherwise, look up by slug and return the id.
 */
async function resolve_id(slug_or_id: string): Promise<string> {
	if (UUID_PATTERN.test(slug_or_id)) {
		return slug_or_id
	}
	const device = await runtime_ref().services.devices.getDevice({ slug: slug_or_id })
	return device.id
}

/**
 * GET /api/v1/devices/[slug]
 * Returns device by id or slug.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const param = event.params.slug!
		const req = UUID_PATTERN.test(param) ? { id: param } : { slug: param }
		const device = await runtime_ref().services.devices.getDevice(req)

		return new Response(JSON.stringify(device), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}

/**
 * PATCH /api/v1/devices/[slug]
 * Partial update. Body may contain name and/or filter_criteria.
 * id is resolved from the path param.
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const param = event.params.slug!

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

		// Resolve path param to id first
		const id = await resolve_id(param)

		// Merge id from path into the body before parsing
		const merged = { ...(typeof body === "object" && body !== null ? body : {}), id }

		const parsed = UpdateDeviceRequestSchema.safeParse(merged)
		if (!parsed.success) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				}),
			)
		}

		const device = await runtime_ref().services.devices.updateDevice(parsed.data)

		return new Response(JSON.stringify(device), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}

/**
 * DELETE /api/v1/devices/[slug]
 * Hard delete. Returns 204.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const param = event.params.slug!
		const id = await resolve_id(param)

		await runtime_ref().services.devices.deleteDevice({ id })

		return new Response(null, { status: 204 })
	} catch (err) {
		return app_error_to_response(err)
	}
}
