import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { ToggleDeviceRequestSchema } from "$lib/schemas/devices/ToggleDevice"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"
import { UUID_PATTERN } from "$lib/server/service/devices/GetDevice"

/**
 * POST /api/v1/devices/[slug]/toggle
 * Toggle device enabled state.
 * Body: { enabled: boolean }
 */
export const POST: RequestHandler = async (event) => {
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

		// Resolve path param to id
		let id: string
		if (UUID_PATTERN.test(param)) {
			id = param
		} else {
			const device = await runtime_ref().services.devices.getDevice({ slug: param })
			id = device.id
		}

		const parsed = ToggleDeviceRequestSchema.safeParse(
			typeof body === "object" && body !== null ? { ...body, id } : { id },
		)
		if (!parsed.success) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				}),
			)
		}

		const device = await runtime_ref().services.devices.toggleDevice(parsed.data)

		return new Response(JSON.stringify(device), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
