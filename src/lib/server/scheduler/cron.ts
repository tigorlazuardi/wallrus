// Cron registry — croner instances per subscription. Real wiring (load
// enabled subscriptions, schedule next fire, recompute on
// CRUD/enable/disable events) lands in the scheduling commit.
//
// See `docs/ARCHITECTURE.md` §Scheduler.

export type CronRegistry = Map<string, unknown> // subscription_id -> Cron

export function create_registry(): CronRegistry {
	return new Map()
}
