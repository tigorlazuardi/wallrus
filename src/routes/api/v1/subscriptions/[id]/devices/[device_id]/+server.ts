import type { RequestHandler } from "@sveltejs/kit"
import { app_error_to_response } from "$lib/server/http/errors"
import { runtime_ref } from "$lib/server/runtime"

/**
 * DELETE /api/v1/subscriptions/[id]/devices/[device_id]
 * Unlink a device from the subscription.
 * Returns 204.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const subscription_id = event.params.id!
		const device_id = event.params.device_id!

		await runtime_ref().services.subscriptions.unlinkDevice({ subscription_id, device_id })

		return new Response(null, { status: 204 })
	} catch (err) {
		return app_error_to_response(err)
	}
}
