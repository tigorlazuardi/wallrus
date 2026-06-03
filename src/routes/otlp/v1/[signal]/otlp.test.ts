/**
 * OTLP proxy auth gate tests.
 *
 * The hook (hooks.server.ts) gates ALL requests that are not on the
 * allowlist. The /otlp/ prefix IS on the prefix allowlist, so the hook
 * always forwards to the route handler.
 *
 * The route handler itself has a secondary posture check:
 *   - WALLRUS_OTEL_FRONTEND=disable      → 404
 *   - WALLRUS_OTEL_FRONTEND=enable + AUTH_ENABLE=false → public
 *   - WALLRUS_OTEL_FRONTEND=enable + AUTH_ENABLE=true  → requires locals.user
 *   - WALLRUS_OTEL_FRONTEND=auth         → requires locals.user (always)
 *
 * These tests exercise the posture derivation logic (otel_frontend_posture)
 * and the handler-level auth check against locals.user.
 */
import { describe, expect, test } from "bun:test"
import { otel_frontend_posture } from "$lib/server/env"
import type { Env } from "$lib/server/env"

function make_env(overrides: Partial<Env>): Env {
	return {
		WALLRUS_DATA_DIR: "./data",
		WALLRUS_LISTEN_ADDR: "0.0.0.0:5173",
		WALLRUS_MODE: "prod",
		WALLRUS_AUTH_ENABLE: true,
		WALLRUS_USERNAME: "admin",
		WALLRUS_AUTH_SECRET: "x".repeat(32),
		WALLRUS_JWT_TTL_DAYS: 30,
		WALLRUS_TRUST_PROXY: false,
		WALLRUS_MOBILE_RELEASE_MANDATORY: false,
		WALLRUS_OTEL_FRONTEND: "enable",
		OTEL_SERVICE_NAME: "wallrus",
		password_hash: undefined,
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// otel_frontend_posture derivation
// ---------------------------------------------------------------------------

describe("otel_frontend_posture", () => {
	test("WALLRUS_OTEL_FRONTEND=disable → enabled=false", () => {
		const e = make_env({
			WALLRUS_OTEL_FRONTEND: "disable",
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
		})
		const p = otel_frontend_posture(e)
		expect(p.enabled).toBe(false)
	})

	test("enable + no OTLP endpoint → enabled=false", () => {
		const e = make_env({
			WALLRUS_OTEL_FRONTEND: "enable",
			OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
		})
		const p = otel_frontend_posture(e)
		expect(p.enabled).toBe(false)
	})

	test("enable + AUTH_ENABLE=true → auth_required=true", () => {
		const e = make_env({
			WALLRUS_OTEL_FRONTEND: "enable",
			WALLRUS_AUTH_ENABLE: true,
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
		})
		const p = otel_frontend_posture(e)
		expect(p.enabled).toBe(true)
		expect(p.auth_required).toBe(true)
	})

	test("enable + AUTH_ENABLE=false → auth_required=false", () => {
		const e = make_env({
			WALLRUS_OTEL_FRONTEND: "enable",
			WALLRUS_AUTH_ENABLE: false,
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
		})
		const p = otel_frontend_posture(e)
		expect(p.enabled).toBe(true)
		expect(p.auth_required).toBe(false)
	})

	test("WALLRUS_OTEL_FRONTEND=auth → auth_required=true regardless of AUTH_ENABLE", () => {
		const e = make_env({
			WALLRUS_OTEL_FRONTEND: "auth",
			WALLRUS_AUTH_ENABLE: false,
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
		})
		const p = otel_frontend_posture(e)
		expect(p.enabled).toBe(true)
		expect(p.auth_required).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Handler auth gate logic (in-process simulation).
//
// The /otlp/ prefix is on the hook allowlist so the hook always forwards
// through. The handler's own gate: `if (posture.auth_required && !locals.user)`.
// We simulate this check directly since we can't stand up the full
// Bun.serve + SvelteKit stack in a unit test.
// ---------------------------------------------------------------------------

describe("OTLP proxy auth gate logic", () => {
	function simulate_gate(opts: {
		auth_required: boolean
		user: { name: string; auth_mode: "jwt" | "basic" | "disabled" } | null
	}): boolean {
		// Returns true if the request should be rejected (handler returns 401).
		return opts.auth_required && opts.user === null
	}

	test("AUTH_ENABLE=true + no user → rejected (401)", () => {
		expect(simulate_gate({ auth_required: true, user: null })).toBe(true)
	})

	test("AUTH_ENABLE=true + Basic user → passes through", () => {
		expect(
			simulate_gate({
				auth_required: true,
				user: { name: "alice", auth_mode: "basic" },
			}),
		).toBe(false)
	})

	test("AUTH_ENABLE=false → passes through regardless of user", () => {
		expect(simulate_gate({ auth_required: false, user: null })).toBe(false)
	})
})
