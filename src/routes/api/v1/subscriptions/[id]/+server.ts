import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { UpdateSubscriptionRequestSchema } from "$lib/schemas/subscriptions/UpdateSubscription"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/subscriptions/[id]
 * Returns subscription by id.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const id = event.params.id!
		const subscription = await runtime_ref().services.subscriptions.getSubscription({ id })

		return new Response(JSON.stringify(subscription), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}

/**
 * PATCH /api/v1/subscriptions/[id]
 * Partial update. Body may contain name, input_params, cron, max_items_inspected.
 * id is taken from the path param.
 */
export const PATCH: RequestHandler = async (event) => {
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

		// Merge id from path into the body before parsing
		const merged = { ...(typeof body === "object" && body !== null ? body : {}), id }

		const parsed = UpdateSubscriptionRequestSchema.safeParse(merged)
		if (!parsed.success) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				}),
			)
		}

		const subscription = await runtime_ref().services.subscriptions.updateSubscription(
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

/**
 * DELETE /api/v1/subscriptions/[id]
 * Soft delete. Returns 204.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const id = event.params.id!

		await runtime_ref().services.subscriptions.deleteSubscription({ id })

		return new Response(null, { status: 204 })
	} catch (err) {
		return app_error_to_response(err)
	}
}
