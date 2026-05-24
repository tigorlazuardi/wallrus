import { describe, expect, test } from "bun:test"
import { parse_basic } from "./basic"

describe("parse_basic", () => {
	test("valid Basic header → { username, password }", () => {
		// btoa("alice:secret") = "YWxpY2U6c2VjcmV0"
		const encoded = btoa("alice:secret")
		const result = parse_basic(`Basic ${encoded}`)
		expect(result).toEqual({ username: "alice", password: "secret" })
	})

	test("password may contain colons", () => {
		const encoded = btoa("user:pass:with:colons")
		const result = parse_basic(`Basic ${encoded}`)
		expect(result).toEqual({ username: "user", password: "pass:with:colons" })
	})

	test("empty password is allowed", () => {
		const encoded = btoa("user:")
		const result = parse_basic(`Basic ${encoded}`)
		expect(result).toEqual({ username: "user", password: "" })
	})

	test("Bearer scheme → null", () => {
		const encoded = btoa("alice:secret")
		expect(parse_basic(`Bearer ${encoded}`)).toBeNull()
	})

	test("lowercase 'basic' scheme → null (case-sensitive)", () => {
		const encoded = btoa("alice:secret")
		expect(parse_basic(`basic ${encoded}`)).toBeNull()
	})

	test("null header → null", () => {
		expect(parse_basic(null)).toBeNull()
	})

	test("undefined header → null", () => {
		expect(parse_basic(undefined)).toBeNull()
	})

	test("empty string → null", () => {
		expect(parse_basic("")).toBeNull()
	})

	test("malformed base64 → null", () => {
		expect(parse_basic("Basic !!!not-base64!!!")).toBeNull()
	})

	test("missing colon in decoded value → null", () => {
		// btoa("nocolon") has no colon in decoded string
		const encoded = btoa("nocolon")
		expect(parse_basic(`Basic ${encoded}`)).toBeNull()
	})
})
