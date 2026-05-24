import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "$lib/server/http/errors"
import { parse_pagination } from "$lib/server/http/pagination"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/subscriptions/[id]/devices
 * Returns devices linked to the subscription.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const subscription_id = event.params.id!
		const pagination = parse_pagination(event.url.searchParams)
		const result = await runtime_ref().services.subscriptions.listSubscriptionDevices({
			subscription_id,
			limit: pagination.limit,
			offset: pagination.offset,
			next: pagination.next ?? undefined,
			prev: pagination.prev ?? undefined,
		})

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}

/**
 * POST /api/v1/subscriptions/[id]/devices
 * Link a device to the subscription.
 * Body: { device_id }
 */
export const POST: RequestHandler = async (event) => {
	try {
		const subscription_id = event.params.id!

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

		if (typeof body !== "object" || body === null || !("device_id" in body)) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "device_id is required.",
				}),
			)
		}

		const device_id = (body as Record<string, unknown>).device_id
		if (typeof device_id !== "string") {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "device_id must be a string.",
				}),
			)
		}

		const link = await runtime_ref().services.subscriptions.linkDevice({
			subscription_id,
			device_id,
		})

		return new Response(JSON.stringify(link), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
