// Per-source serial promise chain. Subscriptions sharing the same source are
// queued; subscriptions on different sources run in parallel. See
// `.claude/rules/scope.md` §Scheduler.

const chains = new Map<string, Promise<void>>()

export function enqueue(source_slug: string, work: () => Promise<void>): Promise<void> {
	const prev = chains.get(source_slug) ?? Promise.resolve()
	const next = prev.catch(() => {}).then(work)
	chains.set(source_slug, next)
	return next
}

export function pending_chains(): ReadonlyMap<string, Promise<void>> {
	return chains
}
