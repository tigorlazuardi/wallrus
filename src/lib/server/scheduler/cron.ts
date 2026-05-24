// Cron registry — croner instances per subscription. Evaluates next-fire
// times every 60s and enqueues eligible subscriptions via the per-source
// promise chain in `queue.ts`.
//
// See `engineering/ARCHITECTURE.md` §Scheduler.

import { and, eq, isNull } from "drizzle-orm"
import { Cron } from "croner"
import type { Runtime } from "../bootstrap"
import { getLogger } from "../telemetry"
import { subscriptions } from "../db/schema"
import { enqueue, wait_idle } from "./queue"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CronEntry = { cron: Cron; source_slug: string }

// ---------------------------------------------------------------------------
// Module-level state — start/stop work without threading handles through.
// ---------------------------------------------------------------------------

let _interval: ReturnType<typeof setInterval> | null = null
let _registry: Map<string, CronEntry> = new Map()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load enabled, non-deleted subscriptions from the DB and build the cron
 * registry. Extracted for testability.
 */
function load_registry(runtime: Runtime): Map<string, CronEntry> {
	const reg = new Map<string, CronEntry>()
	const log = getLogger()

	const rows = runtime.db
		.select({
			id: subscriptions.id,
			source_slug: subscriptions.source_slug,
			cron: subscriptions.cron,
			enabled: subscriptions.enabled,
		})
		.from(subscriptions)
		.where(and(eq(subscriptions.enabled, true), isNull(subscriptions.deleted_at)))
		.all()

	for (const row of rows) {
		try {
			// Cron(pattern) with no callback = schedule-only. We consult nextRun()
			// during the 60s tick rather than letting croner auto-fire.
			const cron = new Cron(row.cron)
			reg.set(row.id, { cron, source_slug: row.source_slug })
		} catch (err) {
			log.warn("invalid cron pattern, skipping subscription", {
				module: "scheduler",
				subscription_id: row.id,
				cron: row.cron,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return reg
}

/**
 * Single tick: walk the registry, enqueue subscriptions whose next fire falls
 * within `[now, now + 60_000)`. Parameterised on `now` so tests can fake the
 * clock.
 */
export function _tick_with_clock(reg: Map<string, CronEntry>, now: number): void {
	const log = getLogger()
	const window_end = now + 60_000

	for (const [subscription_id, { cron, source_slug }] of reg) {
		const next = cron.nextRun()
		if (next === null) continue
		const next_ms = next.getTime()
		if (next_ms >= now && next_ms < window_end) {
			enqueue(source_slug, async () => {
				log.info("would run", { module: "scheduler", subscription_id, source_slug })
			})
		}
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all enabled, non-deleted subscriptions, build a croner registry, and
 * start the 60s tick. Safe to call once per process after `boot()`.
 */
export function start(runtime: Runtime): void {
	const log = getLogger()
	_registry = load_registry(runtime)
	log.info("scheduler started", { module: "scheduler", subscriptions: _registry.size })

	_interval = setInterval(() => {
		_tick_with_clock(_registry, Date.now())
	}, 60_000)
}

/**
 * Stop the interval and drain the queue. Resolves when all in-flight runs
 * settle or after a 5s hard timeout.
 */
export async function stop(): Promise<void> {
	const log = getLogger()
	if (_interval !== null) {
		clearInterval(_interval)
		_interval = null
	}
	log.info("scheduler stopping — draining queue", { module: "lifecycle" })
	await Promise.race([wait_idle(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))])
	log.info("scheduler stopped", { module: "lifecycle" })
}

/**
 * Explicit reload — call after subscription mutations (005-service-subscriptions).
 * Does NOT stop/restart the tick interval; just replaces the registry in place.
 */
export function reload(runtime: Runtime): void {
	_registry = load_registry(runtime)
	getLogger().info("scheduler registry reloaded", {
		module: "scheduler",
		subscriptions: _registry.size,
	})
}
