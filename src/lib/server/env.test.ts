import { describe, expect, test } from "bun:test"
import { parse_env, parse_listen_addr, parse_otlp_headers } from "./env"

// ---------------------------------------------------------------------------
// parse_listen_addr
// ---------------------------------------------------------------------------

describe("parse_listen_addr", () => {
	test("full host:port parses correctly", () => {
		const result = parse_listen_addr("0.0.0.0:5173")
		expect(result).toEqual({ hostname: "0.0.0.0", port: 5173 })
	})

	test(":port (empty host) defaults hostname to 0.0.0.0", () => {
		const result = parse_listen_addr(":5173")
		expect(result).toEqual({ hostname: "0.0.0.0", port: 5173 })
	})

	test("named host:port parses correctly", () => {
		const result = parse_listen_addr("localhost:8080")
		expect(result).toEqual({ hostname: "localhost", port: 8080 })
	})

	test("no colon → throws AppError", () => {
		expect(() => parse_listen_addr("5173")).toThrow()
	})

	test("foo:bar (non-numeric port) → throws AppError", () => {
		expect(() => parse_listen_addr("foo:bar")).toThrow()
	})

	test("port 0 → throws AppError (out of valid range)", () => {
		expect(() => parse_listen_addr("0.0.0.0:0")).toThrow()
	})

	test("port 65536 → throws AppError (out of valid range)", () => {
		expect(() => parse_listen_addr("0.0.0.0:65536")).toThrow()
	})

	test("IPv6-style address with port", () => {
		// lastIndexOf handles [::1]:5173 because last colon is at the ]:port boundary
		const result = parse_listen_addr("::1:5173")
		// "::1" is the hostname, 5173 is the port
		expect(result.port).toBe(5173)
	})
})

// ---------------------------------------------------------------------------
// parse_otlp_headers (existing helper — regression guard)
// ---------------------------------------------------------------------------

describe("parse_otlp_headers", () => {
	test("returns empty object for undefined", () => {
		expect(parse_otlp_headers(undefined)).toEqual({})
	})

	test("parses single key=value", () => {
		expect(parse_otlp_headers("Authorization=Bearer token")).toEqual({
			Authorization: "Bearer token",
		})
	})

	test("parses multiple pairs", () => {
		const result = parse_otlp_headers("k1=v1,k2=v2")
		expect(result).toEqual({ k1: "v1", k2: "v2" })
	})

	test("value may contain =", () => {
		const result = parse_otlp_headers("Authorization=Bearer a=b")
		expect(result).toEqual({ Authorization: "Bearer a=b" })
	})
})

// ---------------------------------------------------------------------------
// parse_env + WALLRUS_MODE
// ---------------------------------------------------------------------------

describe("parse_env WALLRUS_MODE", () => {
	test("defaults to 'prod'", () => {
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "false",
		})
		expect(result.WALLRUS_MODE).toBe("prod")
	})

	test("accepts 'dev'", () => {
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "false",
			WALLRUS_MODE: "dev",
		})
		expect(result.WALLRUS_MODE).toBe("dev")
	})

	test("rejects unknown mode value", () => {
		expect(() =>
			parse_env({
				WALLRUS_AUTH_ENABLE: "false",
				WALLRUS_MODE: "staging",
			}),
		).toThrow()
	})
})
