import type { RequestHandler } from "@sveltejs/kit"
import { clear_session_cookie } from "$lib/server/auth/cookie"

export const POST: RequestHandler = async (event) => {
	clear_session_cookie(event)
	return new Response(null, { status: 204 })
}
