import { z } from "zod"

// Parsed once at boot. All other modules import `env` from here, never read
// `process.env` directly. See `.claude/rules/api.md` §Auth gate for the
// auth-related rules this schema enforces.

const RawEnv = z
	.object({
		WALLRUS_DATA_DIR: z.string().default("./data"),
		WALLRUS_LISTEN_ADDR: z.string().default("0.0.0.0:5173"),
		WALLRUS_AUTH_ENABLE: z
			.union([z.literal("true"), z.literal("false")])
			.default("true")
			.transform((v) => v === "true"),
		WALLRUS_USERNAME: z.string().optional(),
		WALLRUS_PASSWORD: z.string().optional(),
		WALLRUS_AUTH_SECRET: z.string().optional(),
		WALLRUS_JWT_TTL_DAYS: z.coerce.number().int().positive().default(30),
		WALLRUS_TRUST_PROXY: z
			.union([z.literal("true"), z.literal("false")])
			.default("false")
			.transform((v) => v === "true"),
		WALLRUS_OTEL_ENDPOINT: z.string().url().optional(),
	})
	.superRefine((v, ctx) => {
		// Bootstrap fail-fast: when auth is enabled, all three credential env
		// vars are required and AUTH_SECRET must be at least 32 bytes of entropy.
		// See `.claude/rules/api.md` §Credentials.
		if (!v.WALLRUS_AUTH_ENABLE) return
		const missing: string[] = []
		if (!v.WALLRUS_USERNAME) missing.push("WALLRUS_USERNAME")
		if (!v.WALLRUS_PASSWORD) missing.push("WALLRUS_PASSWORD")
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

export type Env = z.infer<typeof RawEnv>

export function parse_env(source: Record<string, string | undefined> = Bun.env): Env {
	const result = RawEnv.safeParse(source)
	if (!result.success) {
		const lines = result.error.issues.map(
			(i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`,
		)
		throw new Error(`invalid env:\n${lines.join("\n")}`)
	}
	return result.data
}
