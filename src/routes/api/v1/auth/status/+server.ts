import type { RequestHandler } from "@sveltejs/kit"
import { env } from "$lib/server/env"

/**
 * GET /api/v1/auth/status
 *
 * Public, un-gated (listed in hooks.server.ts EXACT_ALLOWLIST alongside /healthz).
 * Returns { auth_enabled: boolean } so the mobile setup screen can decide
 * whether to show the username/password fields.
 */
export const GET: RequestHandler = () => {
	const e = env()
	return new Response(JSON.stringify({ auth_enabled: e.WALLRUS_AUTH_ENABLE }), {
		status: 200,
		headers: { "content-type": "application/json" },
	})
}
