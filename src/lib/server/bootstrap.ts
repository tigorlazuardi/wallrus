import { eq } from "drizzle-orm"
import { create_db, type DbClient } from "./db/client"
import { run_migrations } from "./db/migrate"
import { run_history } from "./db/schema"
import { parse_env, type Env } from "./env"
import { db_file_path, ensure_data_dir, ensure_db_perms } from "./fs/perms"
import { telemetry } from "./telemetry"

export type Runtime = {
	env: Env
	db: DbClient
}

// Boot sequence for `wallrus serve`. Idempotent — safe to call once per
// process. See `docs/ARCHITECTURE.md` §Bootstrap sequence.
//
//   1. parse env (zod) — fail-fast on auth misconfig
//   2. ensure data dir + perms (chmod 0700)
//   3. open DB (bun:sqlite via Drizzle), reapply session PRAGMAs
//   4. run pending migrations (drizzle-orm/bun-sqlite/migrator)
//   5. tighten DB file perms (chmod 0600)
//   6. crash recovery: status='running' -> 'failed' / stop_reason='daemon_crash'
//   7. return Runtime for caller (HTTP server, scheduler) to use.
export function boot(): Runtime {
	const env = parse_env()
	if (!env.WALLRUS_AUTH_ENABLE) {
		console.warn(
			"⚠ WALLRUS_AUTH_ENABLE=false — all routes public. " +
				"Wallrus assumes a reverse proxy is handling auth.",
		)
	}

	ensure_data_dir(env.WALLRUS_DATA_DIR)
	const db_path = db_file_path(env.WALLRUS_DATA_DIR)
	const db = create_db(db_path)

	run_migrations(db)
	ensure_db_perms(db_path)

	recover_orphan_runs(db)

	void telemetry // wired here so future spans can be added without circular imports
	return { env, db }
}

// Mark any run_history row left in `running` state as failed on startup —
// indicates the previous daemon process died mid-run. See
// `docs/ARCHITECTURE.md` §Crash recovery.
function recover_orphan_runs(db: DbClient) {
	const now = Date.now()
	db.update(run_history)
		.set({
			status: "failed",
			stop_reason: "daemon_crash",
			error: "daemon crashed mid-run",
			ended_at: now,
		})
		.where(eq(run_history.status, "running"))
		.run()
}
