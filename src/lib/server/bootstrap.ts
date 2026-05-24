import { eq } from "drizzle-orm"
import { create_db, type DbClient } from "./db/client"
import { run_migrations } from "./db/migrate"
import { run_history } from "./db/schema"
import { env as env_singleton, init_password_hash, parse_env, type Env } from "./env"
import { db_file_path, ensure_data_dir, ensure_db_perms } from "./fs/perms"
import { DeviceService } from "./service/devices"
import { SubscriptionService } from "./service/subscriptions"
import { ImageService } from "./service/images"
import { register_sources } from "./sources/_registry"
import { getLogger, initSDK, setDefaultLogger, type SDKResult } from "./telemetry"

export type Runtime = {
	env: Env
	db: DbClient
	sdk: SDKResult
	services: {
		devices: DeviceService
		subscriptions: SubscriptionService
		images: ImageService
	}
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
export async function boot(): Promise<Runtime> {
	// Warm the env singleton so subsequent imports (route handlers, services)
	// share the same parsed instance. parse_env is still used here so the
	// fail-fast path runs synchronously before anything else opens a DB or
	// starts the SDK.
	const env = parse_env()
	// Trigger the lazy cache in env.ts with the same source so route handlers
	// reading `env()` get the identical object.
	env_singleton()
	// Hash the plaintext password once at boot (CPU-bound; done here so no
	// request handler ever touches the plaintext). No-op if password_hash is
	// already populated (WALLRUS_PASSWORD_HASH was set directly).
	await init_password_hash()

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

	register_sources()

	const services = {
		devices: new DeviceService({ db }),
		subscriptions: new SubscriptionService({ db }),
		images: new ImageService({ db }),
	}

	return { env, db, sdk, services }
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
export function recover_orphan_runs(db: DbClient) {
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
