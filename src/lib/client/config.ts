/**
 * Runtime-configurable API base URL.
 *
 * Web: PUBLIC_API_BASE="" (empty → relative fetch, same origin).
 * Mobile (slice 016): set_api_base() is called at boot from preferences.
 */

let _api_base = ""

/**
 * Override the API base URL at runtime.
 * Trailing slash is normalised away so callers can always write
 * `${api_base()}/api/v1/...` without double-slash risk.
 */
export function set_api_base(url: string): void {
	_api_base = url.replace(/\/$/, "")
}

/**
 * Return the current API base URL.
 *
 * Resolution order:
 *   1. Runtime override via set_api_base() (for mobile shell, slice 016).
 *   2. Build-time env var PUBLIC_API_BASE (Vite/SvelteKit inject).
 *   3. Empty string → relative fetch (same-origin web default).
 */
export function api_base(): string {
	return _api_base || (import.meta.env.PUBLIC_API_BASE as string | undefined) || ""
}
