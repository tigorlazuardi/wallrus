/** Sliding-window rate limiter for auth failures, keyed by IP address. */

export const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const THRESHOLD = 5 // max failures before lockout

// Map from IP → array of failure timestamps (ms epoch).
// Exported for test-time injection of stale timestamps.
export const failures = new Map<string, number[]>()

/** Prune timestamps older than the window from the entry for `ip`. */
function prune(ip: string): number[] {
	const now = Date.now()
	const cutoff = now - WINDOW_MS
	const existing = failures.get(ip) ?? []
	const fresh = existing.filter((ts) => ts > cutoff)
	if (fresh.length === 0) {
		failures.delete(ip)
	} else {
		failures.set(ip, fresh)
	}
	return fresh
}

/**
 * Record a failed auth attempt from `ip`.
 * Must be called after a bad password — before sending the 401 response.
 */
export function record_failure(ip: string): void {
	prune(ip)
	const existing = failures.get(ip) ?? []
	existing.push(Date.now())
	failures.set(ip, existing)
}

/**
 * Returns true if `ip` has reached the failure threshold within the window
 * and should receive a 429 (before any password check is performed).
 */
export function is_locked(ip: string): boolean {
	const fresh = prune(ip)
	return fresh.length >= THRESHOLD
}

/**
 * Clear the failure counter for `ip` immediately (call after a successful login).
 */
export function reset(ip: string): void {
	failures.delete(ip)
}
