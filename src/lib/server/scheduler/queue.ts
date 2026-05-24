// Per-source serial promise chain. Subscriptions sharing the same source are
// queued; subscriptions on different sources run in parallel. See
// `.claude/rules/scope.md` §Scheduler.

const chains = new Map<string, Promise<void>>()

/**
 * Enqueue `fn` for the given `source_slug`. Runs are serialised per slug —
 * the next run only starts after the previous one settles (resolve or reject).
 * Returns a promise that resolves when `fn` itself resolves.
 */
export function enqueue(source_slug: string, fn: () => Promise<void>): Promise<void> {
	const prev = chains.get(source_slug) ?? Promise.resolve()
	// `.catch(() => {})` swallows errors from the previous link so a failing
	// run does not block all future runs for the same source.
	const next = prev.catch(() => {}).then(fn)
	chains.set(source_slug, next)
	return next
}

/**
 * Resolves when all in-flight promise chains have settled (no more pending
 * work in any source queue). Safe to await on shutdown.
 */
export function wait_idle(): Promise<void> {
	const running = Array.from(chains.values())
	if (running.length === 0) return Promise.resolve()
	return Promise.all(running.map((p) => p.catch(() => {}))).then(() => {
		// After all current chains settle, check if any new work was enqueued
		// by the chains themselves (re-entrant enqueue). If the map has grown,
		// recurse once — this is not a busy loop because chains only grow via
		// explicit enqueue() calls, which are bounded in practice.
		const still_running = Array.from(chains.values())
		if (still_running.length > running.length) return wait_idle()
	})
}
