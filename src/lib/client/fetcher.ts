/**
 * /api/v1/* fetch wrapper.
 *
 * Prepends api_base() to every path so the same code works in a web context
 * (same-origin, base="") and in the future mobile shell (absolute base URL
 * injected at runtime via set_api_base() in slice 016).
 *
 * Usage:
 *   import { apiFetch } from "$lib/client/fetcher"
 *
 *   const res = await apiFetch("/api/v1/devices")
 *   const res = await apiFetch("/api/v1/devices", { method: "POST", body: ... })
 */

import { api_base } from "$lib/client/config"

/**
 * Fetch a wallrus API path, prepending the runtime API base URL.
 *
 * @param path  Must start with "/api/v1/". The base is prepended automatically.
 * @param init  Optional RequestInit forwarded to fetch().
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const url = `${api_base()}${path}`
	return fetch(url, init)
}
