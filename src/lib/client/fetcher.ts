/**
 * /api/v1/* fetch wrapper.
 *
 * Prepends api_base() to every path so the same code works in a web context
 * (same-origin, base="") and in the mobile shell (absolute base URL
 * injected at runtime via set_api_base() in slice 016).
 *
 * On native (Capacitor) platforms, reads the stored auth_token from
 * Preferences and injects an Authorization: Bearer <token> header.
 * The web path is unchanged — it relies on the httpOnly auth_session cookie.
 *
 * Usage:
 *   import { apiFetch } from "$lib/client/fetcher"
 *
 *   const res = await apiFetch("/api/v1/devices")
 *   const res = await apiFetch("/api/v1/devices", { method: "POST", body: ... })
 */

import { Preferences } from "@capacitor/preferences"
import { api_base } from "$lib/client/config"
import { isNativePlatform } from "$lib/client/mobile/platform"

/**
 * Fetch a wallrus API path, prepending the runtime API base URL.
 *
 * On native: injects Authorization: Bearer from stored auth_token.
 * On web: no header injection; the cookie handles auth.
 *
 * @param path  Must start with "/api/v1/". The base is prepended automatically.
 * @param init  Optional RequestInit forwarded to fetch().
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const url = `${api_base()}${path}`

	if (isNativePlatform()) {
		const { value: token } = await Preferences.get({ key: "auth_token" })
		if (token) {
			// Merge any existing headers with the Bearer token.
			const headers = new Headers(init?.headers)
			headers.set("Authorization", `Bearer ${token}`)
			return fetch(url, { ...init, headers })
		}
	}

	return fetch(url, init)
}
