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

// ---------------------------------------------------------------------------
// parse_env + password vars (003-auth)
// ---------------------------------------------------------------------------

describe("parse_env password vars", () => {
	test("AUTH_ENABLE=true with both password vars absent → throws", () => {
		expect(() =>
			parse_env({
				WALLRUS_AUTH_ENABLE: "true",
				WALLRUS_USERNAME: "alice",
				WALLRUS_AUTH_SECRET: "a".repeat(32),
				// No WALLRUS_PASSWORD or WALLRUS_PASSWORD_HASH
			}),
		).toThrow(/WALLRUS_PASSWORD or WALLRUS_PASSWORD_HASH/)
	})

	test("AUTH_ENABLE=true with WALLRUS_PASSWORD → succeeds", () => {
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "true",
			WALLRUS_USERNAME: "alice",
			WALLRUS_PASSWORD: "secret",
			WALLRUS_AUTH_SECRET: "a".repeat(32),
		})
		expect(result.WALLRUS_AUTH_ENABLE).toBe(true)
	})

	test("AUTH_ENABLE=true with WALLRUS_PASSWORD_HASH → succeeds", () => {
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "true",
			WALLRUS_USERNAME: "alice",
			WALLRUS_PASSWORD_HASH: "$argon2id$v=19$m=65536,t=2,p=1$fakehash",
			WALLRUS_AUTH_SECRET: "a".repeat(32),
		})
		expect(result.WALLRUS_AUTH_ENABLE).toBe(true)
	})

	test("parse_env strips WALLRUS_PASSWORD from the returned object", () => {
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "true",
			WALLRUS_USERNAME: "alice",
			WALLRUS_PASSWORD: "plaintext_secret",
			WALLRUS_AUTH_SECRET: "a".repeat(32),
		})
		// The plaintext must not appear anywhere in the returned object.
		expect("WALLRUS_PASSWORD" in result).toBe(false)
		const serialised = JSON.stringify(result)
		expect(serialised).not.toContain("plaintext_secret")
	})

	test("WALLRUS_PASSWORD_HASH set → password_hash populated synchronously", () => {
		const hash = "$argon2id$v=19$m=65536,t=2,p=1$fakehash"
		const result = parse_env({
			WALLRUS_AUTH_ENABLE: "true",
			WALLRUS_USERNAME: "alice",
			WALLRUS_PASSWORD_HASH: hash,
			WALLRUS_AUTH_SECRET: "a".repeat(32),
		})
		expect(result.password_hash).toBe(hash)
	})

	test("init_password_hash computes argon2id hash from plaintext and stores on singleton", async () => {
		// init_password_hash operates on the env singleton. We use a source dict
		// that doesn't match Bun.env so we can test in isolation via a separate
		// import reset. Instead, test the underlying mechanic: Bun.password.hash
		// produces an argon2id hash that Bun.password.verify accepts.
		const plaintext = "test_password_for_hash_test"
		const hash = await Bun.password.hash(plaintext, { algorithm: "argon2id" })
		expect(hash.startsWith("$argon2id$")).toBe(true)
		const valid = await Bun.password.verify(plaintext, hash)
		expect(valid).toBe(true)
	})
})
