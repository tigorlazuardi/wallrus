import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { ToggleSubscriptionRequestSchema } from "$lib/schemas/subscriptions/ToggleSubscription"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * POST /api/v1/subscriptions/[id]/toggle
 * Toggle subscription enabled state.
 * Body: { enabled: boolean }
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

		const parsed = ToggleSubscriptionRequestSchema.safeParse(
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

		const subscription = await runtime_ref().services.subscriptions.toggleSubscription(
			parsed.data,
		)

		return new Response(JSON.stringify(subscription), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
