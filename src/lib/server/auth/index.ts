import type { RequestEvent } from "@sveltejs/kit"
import { env } from "$lib/server/env"
import { parse_basic } from "./basic"
import { SESSION_COOKIE } from "./cookie"
import { verify_session } from "./jwt"
import { verify_password } from "./password"

export type AuthResult = {
	name: string
	auth_mode: "jwt" | "basic" | "disabled"
}

/**
 * Resolve the authenticated user from the incoming request.
 *
 * Resolution order:
 *  1. If WALLRUS_AUTH_ENABLE=false → return { name: username ?? "anonymous", auth_mode: "disabled" }
 *  2. Authorization: Basic … → verify_password → { name, auth_mode: "basic" }
 *  3. wallrus_session cookie → verify_session → { name: sub, auth_mode: "jwt" }
 *  4. Neither → null (unauthenticated)
 */
export async function authenticate(event: RequestEvent): Promise<AuthResult | null> {
	const e = env()

	if (!e.WALLRUS_AUTH_ENABLE) {
		return { name: e.WALLRUS_USERNAME ?? "anonymous", auth_mode: "disabled" }
	}

	// --- Basic auth ---
	const auth_header = event.request.headers.get("authorization")
	if (auth_header) {
		const creds = parse_basic(auth_header)
		if (creds && e.WALLRUS_USERNAME && e.password_hash) {
			if (
				creds.username === e.WALLRUS_USERNAME &&
				(await verify_password(creds.password, e.password_hash))
			) {
				return { name: creds.username, auth_mode: "basic" }
			}
		}
		// Authorization header present but invalid → don't fall through to cookie.
		return null
	}

	// --- Session cookie (JWT) ---
	const token = event.cookies.get(SESSION_COOKIE)
	if (token && e.WALLRUS_AUTH_SECRET) {
		const claims = await verify_session(token, e.WALLRUS_AUTH_SECRET)
		if (claims) {
			return { name: claims.sub, auth_mode: "jwt" }
		}
	}

	return null
}
