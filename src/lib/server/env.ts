import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { z } from "zod"

// Parsed once at boot. All other modules import `env` from here, never read
// `process.env` directly. See `.claude/rules/api.md` §Auth gate for the
// auth-related rules this schema enforces.

const RawEnv = z
	.object({
		WALLRUS_DATA_DIR: z.string().default("./data"),
		WALLRUS_LISTEN_ADDR: z.string().default("0.0.0.0:5173"),
		WALLRUS_MODE: z.enum(["prod", "dev"]).default("prod"),
		WALLRUS_AUTH_ENABLE: z
			.union([z.literal("true"), z.literal("false")])
			.default("false")
			.transform((v) => v === "true"),
		WALLRUS_USERNAME: z.string().optional(),
		WALLRUS_PASSWORD: z.string().optional(),
		WALLRUS_PASSWORD_HASH: z.string().optional(),
		WALLRUS_AUTH_SECRET: z.string().optional(),
		WALLRUS_JWT_TTL_DAYS: z.coerce.number().int().positive().default(30),
		WALLRUS_TRUST_PROXY: z
			.union([z.literal("true"), z.literal("false")])
			.default("false")
			.transform((v) => v === "true"),

		// Browser → /otlp proxy gate. See `.claude/rules/telemetry.md` §Browser
		// telemetry proxy. `enable` mirrors the main auth posture, `auth`
		// forces authenticated submission, `disable` turns the proxy off.
		WALLRUS_OTEL_FRONTEND: z
			.union([z.literal("enable"), z.literal("auth"), z.literal("disable")])
			.default("enable"),

		// Standard OpenTelemetry env names — same vars an OTel SDK already picks
		// up automatically. wallrus reads them through Zod so they're typed.
		OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
		OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
		OTEL_SERVICE_NAME: z.string().default("wallrus"),
		OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),
	})
	.superRefine((v, ctx) => {
		// Bootstrap fail-fast: when auth is enabled, all three credential env
		// vars are required and AUTH_SECRET must be at least 32 bytes of entropy.
		// See `.claude/rules/api.md` §Credentials.
		if (!v.WALLRUS_AUTH_ENABLE) return
		const missing: string[] = []
		if (!v.WALLRUS_USERNAME) missing.push("WALLRUS_USERNAME")
		if (!v.WALLRUS_PASSWORD && !v.WALLRUS_PASSWORD_HASH)
			missing.push("WALLRUS_PASSWORD or WALLRUS_PASSWORD_HASH")
		if (!v.WALLRUS_AUTH_SECRET) missing.push("WALLRUS_AUTH_SECRET")
		if (missing.length > 0) {
			ctx.addIssue({
				code: "custom",
				message: `WALLRUS_AUTH_ENABLE=true but missing: ${missing.join(", ")}. Set them, or set WALLRUS_AUTH_ENABLE=false to disable auth (e.g. behind a reverse proxy). Generate a secret with: openssl rand -hex 32`,
				path: ["WALLRUS_AUTH_SECRET"],
			})
			return
		}
		const secret_bytes = (v.WALLRUS_AUTH_SECRET ?? "").length
		if (secret_bytes < 32) {
			ctx.addIssue({
				code: "custom",
				message: `WALLRUS_AUTH_SECRET must be at least 32 bytes of entropy (got ${secret_bytes}). Generate a fresh one with: openssl rand -hex 32`,
				path: ["WALLRUS_AUTH_SECRET"],
			})
		}
	})

// The raw Zod-inferred shape, before we strip WALLRUS_PASSWORD.
type RawEnvData = z.infer<typeof RawEnv>

// Env is the public shape: WALLRUS_PASSWORD is omitted (stripped at parse time
// so it cannot leak via inspect / serialisation). password_hash is the derived
// field populated async by `init_password_hash()` after boot.
export type Env = Omit<RawEnvData, "WALLRUS_PASSWORD"> & {
	password_hash?: string
}

export function parse_env(source: Record<string, string | undefined> = Bun.env): Env {
	const result = RawEnv.safeParse(source)
	if (!result.success) {
		const lines = result.error.issues.map(
			(i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`,
		)
		throw new Error(`invalid env:\n${lines.join("\n")}`)
	}
	// Strip the plaintext password so it can't leak via console.log / serialise.
	// If WALLRUS_PASSWORD_HASH is already set, populate password_hash immediately
	// (synchronous path — no hashing needed).
	const { WALLRUS_PASSWORD: _discarded, ...safe } = result.data
	const out: Env = safe
	if (safe.WALLRUS_PASSWORD_HASH) {
		out.password_hash = safe.WALLRUS_PASSWORD_HASH
	}
	return out
}

// Lazy-cached env singleton stored on globalThis so it is shared between
// cli.ts (loaded from source) and the SvelteKit build output (which has its
// own compiled copy of this module). Without globalThis, `init_password_hash()`
// in cli.ts would mutate the source-module copy while the built
// hooks.server.ts would consult a different compiled-module copy and see
// `password_hash: undefined`. Pattern mirrors runtime.ts §globals.
declare global {
	var __wallrus_env__: Env | null
}

if (!("__wallrus_env__" in globalThis)) {
	globalThis.__wallrus_env__ = null
}

export function env(): Env {
	if (!globalThis.__wallrus_env__) globalThis.__wallrus_env__ = parse_env()
	return globalThis.__wallrus_env__
}

// Async init called once at boot (after parse_env) to compute and cache the
// argon2id hash. If WALLRUS_PASSWORD_HASH is already set we use it directly.
// If only WALLRUS_PASSWORD was set (stripped from Env), we accept the plaintext
// from the raw source so we can hash it once and never hold it again.
// After this call, `env().password_hash` is populated and all auth modules use
// that — no route handler ever touches a plaintext password.
export async function init_password_hash(
	source: Record<string, string | undefined> = Bun.env,
): Promise<void> {
	const e = env()
	if (e.password_hash) return // already set (WALLRUS_PASSWORD_HASH was provided)
	// Hash the plaintext (still in the raw source; already stripped from Env).
	const plaintext = source["WALLRUS_PASSWORD"]
	if (plaintext) {
		e.password_hash = await Bun.password.hash(plaintext, { algorithm: "argon2id" })
	}
	// If neither is set (AUTH_ENABLE=false case), password_hash stays undefined.
}

// Parses the OpenTelemetry-standard `OTEL_EXPORTER_OTLP_HEADERS` format
// (`key1=value1,key2=value2`). Values may contain `=`, so only the first `=`
// per pair splits. Trims whitespace around keys + values. Used by the
// `/otlp` proxy to inject Authorization / API key headers server-side.
export function parse_otlp_headers(raw: string | undefined): Record<string, string> {
	const out: Record<string, string> = {}
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

// Parses `WALLRUS_LISTEN_ADDR` (format: `host:port` or `:port`) into the
// `{ hostname, port }` shape `Bun.serve` expects. Throws `AppError` on
// invalid input so boot fails fast rather than binding to a wrong address.
//
// Examples:
//   "0.0.0.0:5173" → { hostname: "0.0.0.0", port: 5173 }
//   ":5173"        → { hostname: "0.0.0.0", port: 5173 }  (empty host → 0.0.0.0)
//   "5173"         → throws (no colon → ambiguous)
//   "foo:bar"      → throws (NaN port)
export function parse_listen_addr(raw: string): { hostname: string; port: number } {
	const last_colon = raw.lastIndexOf(":")
	if (last_colon === -1) {
		throw new AppError({
			message: `WALLRUS_LISTEN_ADDR must be host:port, got: ${raw}`,
			publicMessage: "WALLRUS_LISTEN_ADDR must be host:port",
			status: 500,
			fields: { raw },
		})
	}
	const host_part = raw.slice(0, last_colon)
	const port_part = raw.slice(last_colon + 1)
	const port = Number(port_part)
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new AppError({
			message: `WALLRUS_LISTEN_ADDR port must be 1-65535, got: ${port_part}`,
			publicMessage: "WALLRUS_LISTEN_ADDR must be host:port",
			status: 500,
			fields: { raw, port_part },
		})
	}
	const hostname = host_part === "" ? "0.0.0.0" : host_part
	return { hostname, port }
}

// Browser telemetry posture derived from WALLRUS_OTEL_FRONTEND + the rest of
// the env. Used by both the /otlp proxy gate and the /api/v1/otel/discover
// endpoint so clients can decide whether to even attempt forwarding spans.
export type OtelFrontendPosture = {
	enabled: boolean
	auth_required: boolean
	mode: Env["WALLRUS_OTEL_FRONTEND"]
}

export function otel_frontend_posture(env: Env): OtelFrontendPosture {
	const has_collector = Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT)
	const enabled = env.WALLRUS_OTEL_FRONTEND !== "disable" && has_collector
	const auth_required =
		env.WALLRUS_OTEL_FRONTEND === "auth" ||
		(env.WALLRUS_OTEL_FRONTEND === "enable" && env.WALLRUS_AUTH_ENABLE)
	return { enabled, auth_required, mode: env.WALLRUS_OTEL_FRONTEND }
}
