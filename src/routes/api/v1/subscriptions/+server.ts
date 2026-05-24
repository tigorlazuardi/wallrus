import type { RequestHandler } from "@sveltejs/kit"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { CreateSubscriptionRequestSchema } from "$lib/schemas/subscriptions/CreateSubscription"
import { app_error_to_response } from "$lib/server/http/errors"
import { parse_pagination } from "$lib/server/http/pagination"
import { runtime_ref } from "$lib/server/runtime"

/**
 * GET /api/v1/subscriptions
 * Returns paginated list of subscriptions.
 * Query params: next, prev, offset, limit, enabled, source_slug, include_deleted
 */
export const GET: RequestHandler = async (event) => {
	try {
		const sp = event.url.searchParams
		const pagination = parse_pagination(sp)

		// Parse optional `enabled` boolean filter
		let enabled: boolean | undefined
		const enabled_raw = sp.get("enabled")
		if (enabled_raw !== null) {
			if (enabled_raw === "true") enabled = true
			else if (enabled_raw === "false") enabled = false
			else {
				return app_error_to_response(
					AppError.fail("validation.enabled", {
						status: 400,
						publicMessage: "enabled must be 'true' or 'false'",
					}),
				)
			}
		}

		const source_slug = sp.get("source_slug") ?? undefined
		const include_deleted = sp.get("include_deleted") === "true"

		const result = await runtime_ref().services.subscriptions.listSubscriptions({
			limit: pagination.limit,
			offset: pagination.offset,
			next: pagination.next ?? undefined,
			prev: pagination.prev ?? undefined,
			enabled,
			source_slug,
			include_deleted,
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
 * POST /api/v1/subscriptions
 * Create a new subscription.
 * Body: { source_slug, name, input_params?, cron, max_items_inspected? }
 */
export const POST: RequestHandler = async (event) => {
	try {
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

		const parsed = CreateSubscriptionRequestSchema.safeParse(body)
		if (!parsed.success) {
			return app_error_to_response(
				AppError.fail("validation.body", {
					status: 400,
					publicMessage: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				}),
			)
		}

		const subscription = await runtime_ref().services.subscriptions.createSubscription(
			parsed.data,
		)

		return new Response(JSON.stringify(subscription), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		})
	} catch (err) {
		return app_error_to_response(err)
	}
}
