import { eq } from "drizzle-orm"
import { create_db, type DbClient } from "./db/client"
import { run_migrations } from "./db/migrate"
import { run_history } from "./db/schema"
import { parse_env, type Env } from "./env"
import { db_file_path, ensure_data_dir, ensure_db_perms } from "./fs/perms"
import { getLogger, initSDK, setDefaultLogger, type SDKResult } from "./telemetry"

export type Runtime = {
	env: Env
	db: DbClient
	sdk: SDKResult
}

// Boot sequence for `wallrus serve`. Idempotent — safe to call once per
// process. See `engineering/ARCHITECTURE.md` §Bootstrap sequence.
//
//   1. parse env (zod) — fail-fast on auth misconfig
//   2. init OTel SDK (logger / tracer / meter providers + exporters)
//   3. ensure data dir + perms (chmod 0700)
//   4. open DB (bun:sqlite via Drizzle), reapply session PRAGMAs
//   5. run pending migrations (drizzle-orm/bun-sqlite/migrator)
//   6. tighten DB file perms (chmod 0600)
//   7. crash recovery: status='running' -> 'failed' / stop_reason='daemon_crash'
//   8. return Runtime for caller (HTTP server, scheduler) to use.
export function boot(): Runtime {
	const env = parse_env()

	// Init OTel SDK first so every subsequent log line, span, and metric
	// flows through the configured exporters. Endpoint is optional — when
	// `OTEL_EXPORTER_OTLP_ENDPOINT` is unset the SDK still wires the logger
	// but skips OTLP export. Standard OTel env names; an OTel collector
	// will pick the same vars up automatically.
	const sdk = initSDK({
		serviceName: env.OTEL_SERVICE_NAME,
		exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
		resourceAttributes: parse_resource_attributes(env.OTEL_RESOURCE_ATTRIBUTES),
	})
	setDefaultLogger(sdk.logger)

	const log = getLogger()
	if (!env.WALLRUS_AUTH_ENABLE) {
		log.warn("WALLRUS_AUTH_ENABLE=false — all routes public, assumes upstream reverse proxy")
	}

	ensure_data_dir(env.WALLRUS_DATA_DIR)
	const db_path = db_file_path(env.WALLRUS_DATA_DIR)
	const db = create_db(db_path)

	run_migrations(db)
	ensure_db_perms(db_path)

	recover_orphan_runs(db)

	return { env, db, sdk }
}

// Parse the OpenTelemetry-standard `OTEL_RESOURCE_ATTRIBUTES` env format
// (k1=v1,k2=v2,...) into the Record<string, string> shape SDKConfig expects.
// Defaults: `service.namespace=homelab`. User-provided keys override.
function parse_resource_attributes(raw: string | undefined): Record<string, string> {
	const out: Record<string, string> = { "service.namespace": "homelab" }
	if (!raw) return out
	for (const pair of raw.split(",")) {
		const idx = pair.indexOf("=")
		if (idx < 1) continue
		const k = pair.slice(0, idx).trim()
		const v = pair.slice(idx + 1).trim()
		if (k && v) out[k] = v
	}
	return out
}

// Mark any run_history row left in `running` state as failed on startup —
// indicates the previous daemon process died mid-run. See
// `engineering/ARCHITECTURE.md` §Crash recovery.
function recover_orphan_runs(db: DbClient) {
	db.update(run_history)
		.set({
			status: "failed",
			stop_reason: "daemon_crash",
			error: "daemon crashed mid-run",
			ended_at: Date.now(),
		})
		.where(eq(run_history.status, "running"))
		.run()
}
