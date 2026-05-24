import type { RequestEvent } from "@sveltejs/kit"

/** The name of the session cookie. */
export const SESSION_COOKIE = "wallrus_session"

/** Max-Age in seconds: 30 days. */
const MAX_AGE = 30 * 24 * 60 * 60 // 2592000

/**
 * Set the wallrus_session cookie on the response.
 * Attributes: HttpOnly, SameSite=Lax, Path=/, Max-Age=30d, Secure when https.
 */
export function set_session_cookie(event: RequestEvent, token: string): void {
	const secure = event.url.protocol === "https:"
	event.cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: MAX_AGE,
		secure,
	})
}

/**
 * Clear the wallrus_session cookie (sets Max-Age=0 to expire it immediately).
 */
export function clear_session_cookie(event: RequestEvent): void {
	event.cookies.delete(SESSION_COOKIE, { path: "/" })
}
