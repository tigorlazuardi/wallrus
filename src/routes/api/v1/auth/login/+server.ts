import type { RequestHandler } from "@sveltejs/kit"
import { env } from "$lib/server/env"
import { is_locked, record_failure, reset } from "$lib/server/auth/rate-limit"
import { verify_password } from "$lib/server/auth/password"
import { sign_session } from "$lib/server/auth/jwt"
import { set_session_cookie } from "$lib/server/auth/cookie"
import { LoginRequestSchema } from "$lib/schemas/auth/Login"

export const POST: RequestHandler = async (event) => {
	// Rate limit check — performed before any credential access.
	let ip: string
	try {
		ip = event.getClientAddress()
	} catch {
		ip = "unknown"
	}

	if (is_locked(ip)) {
		return new Response(
			JSON.stringify({
				error: {
					code: "auth.rate_limited",
					message: "Too many failed attempts. Try again later.",
				},
			}),
			{ status: 429, headers: { "content-type": "application/json" } },
		)
	}

	// Parse + validate body.
	let body: unknown
	try {
		body = await event.request.json()
	} catch {
		return new Response(
			JSON.stringify({ error: { code: "auth.bad_request", message: "Invalid JSON body." } }),
			{ status: 400, headers: { "content-type": "application/json" } },
		)
	}

	const parsed = LoginRequestSchema.safeParse(body)
	if (!parsed.success) {
		return new Response(
			JSON.stringify({
				error: {
					code: "auth.validation",
					message: "Validation failed.",
					fields: parsed.error.flatten().fieldErrors,
				},
			}),
			{ status: 400, headers: { "content-type": "application/json" } },
		)
	}

	const e = env()

	// Auth disabled — no-op 204 (do not set cookie; caller is already
	// authenticated via reverse proxy or trusts the network).
	if (!e.WALLRUS_AUTH_ENABLE) {
		return new Response(null, { status: 204 })
	}

	const { username, password } = parsed.data

	// Constant-time username comparison (avoids timing oracle on username length).
	const expected_username = e.WALLRUS_USERNAME ?? ""
	const username_ok = username === expected_username

	// Always verify the password hash (even on username mismatch) to avoid
	// timing differences that reveal whether the username was correct.
	const hash = e.password_hash ?? ""
	const password_ok = hash ? await verify_password(password, hash) : false

	if (!username_ok || !password_ok) {
		record_failure(ip)
		return new Response(
			JSON.stringify({
				error: {
					code: "auth.invalid_credentials",
					message: "Invalid credentials.",
				},
			}),
			{ status: 401, headers: { "content-type": "application/json" } },
		)
	}

	// Success — sign JWT, set cookie, clear rate-limit counter.
	reset(ip)
	const token = await sign_session({ username, secret: e.WALLRUS_AUTH_SECRET! })
	set_session_cookie(event, token)

	return new Response(null, { status: 204 })
}
