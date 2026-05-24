import { describe, expect, test } from "bun:test"
import { decode_cursor, encode_cursor, parse_pagination } from "./pagination"

describe("encode_cursor / decode_cursor", () => {
	test("roundtrip preserves created_at and id", () => {
		const cursor = { created_at: 1700000000000, id: "0193b6f0-1234-7000-8000-000000000001" }
		const encoded = encode_cursor(cursor)
		const decoded = decode_cursor(encoded)
		expect(decoded).toEqual(cursor)
	})

	test("encoded string contains no padding (=)", () => {
		const cursor = { created_at: 123, id: "abc" }
		const encoded = encode_cursor(cursor)
		expect(encoded).not.toContain("=")
	})

	test("encoded string uses base64url chars only (no + or /)", () => {
		for (let i = 0; i < 20; i++) {
			const cursor = { created_at: i * 1000, id: `id-${i}` }
			const encoded = encode_cursor(cursor)
			expect(encoded).not.toContain("+")
			expect(encoded).not.toContain("/")
		}
	})

	test("decode_cursor returns null for empty string", () => {
		expect(decode_cursor("")).toBeNull()
	})

	test("decode_cursor returns null for garbage input", () => {
		expect(decode_cursor("not-valid-base64url!@#$")).toBeNull()
	})

	test("decode_cursor returns null for valid base64 but wrong shape", () => {
		// valid base64url of `{"foo":"bar"}` — wrong shape
		const bad = Buffer.from('{"foo":"bar"}').toString("base64url")
		expect(decode_cursor(bad)).toBeNull()
	})

	test("decode_cursor returns null for missing id field", () => {
		const bad = Buffer.from('{"created_at":123}').toString("base64url")
		expect(decode_cursor(bad)).toBeNull()
	})

	test("decode_cursor returns null for missing created_at field", () => {
		const bad = Buffer.from('{"id":"abc"}').toString("base64url")
		expect(decode_cursor(bad)).toBeNull()
	})

	test("decode_cursor returns null for null JSON", () => {
		const bad = Buffer.from("null").toString("base64url")
		expect(decode_cursor(bad)).toBeNull()
	})

	test("decode_cursor does not throw on any input", () => {
		const inputs = ["", "!!!!", "abc", "e30", "bnVsbA"]
		for (const s of inputs) {
			expect(() => decode_cursor(s)).not.toThrow()
		}
	})
})

describe("parse_pagination", () => {
	test("default limit is 50", () => {
		const p = parse_pagination(new URLSearchParams())
		expect(p.limit).toBe(50)
	})

	test("default offset is 0", () => {
		const p = parse_pagination(new URLSearchParams())
		expect(p.offset).toBe(0)
	})

	test("limit clamped to minimum of 1", () => {
		const p = parse_pagination(new URLSearchParams("limit=0"))
		expect(p.limit).toBe(1)
	})

	test("negative limit clamped to 1", () => {
		const p = parse_pagination(new URLSearchParams("limit=-5"))
		expect(p.limit).toBe(1)
	})

	test("limit clamped to maximum of 200", () => {
		const p = parse_pagination(new URLSearchParams("limit=999"))
		expect(p.limit).toBe(200)
	})

	test("limit=200 accepted as-is", () => {
		const p = parse_pagination(new URLSearchParams("limit=200"))
		expect(p.limit).toBe(200)
	})

	test("limit=1 accepted as-is", () => {
		const p = parse_pagination(new URLSearchParams("limit=1"))
		expect(p.limit).toBe(1)
	})

	test("explicit offset respected", () => {
		const p = parse_pagination(new URLSearchParams("offset=10"))
		expect(p.offset).toBe(10)
	})

	test("negative offset clamped to 0", () => {
		const p = parse_pagination(new URLSearchParams("offset=-1"))
		expect(p.offset).toBe(0)
	})

	test("next cursor is returned when present", () => {
		const p = parse_pagination(new URLSearchParams("next=abc123"))
		expect(p.next).toBe("abc123")
		expect(p.prev).toBeNull()
	})

	test("prev cursor is returned when present", () => {
		const p = parse_pagination(new URLSearchParams("prev=xyz789"))
		expect(p.prev).toBe("xyz789")
		expect(p.next).toBeNull()
	})

	test("next wins when both next and prev are present", () => {
		const p = parse_pagination(new URLSearchParams("next=aaa&prev=bbb"))
		expect(p.next).toBe("aaa")
		expect(p.prev).toBeNull()
	})

	test("no cursors → both null", () => {
		const p = parse_pagination(new URLSearchParams())
		expect(p.next).toBeNull()
		expect(p.prev).toBeNull()
	})

	test("non-numeric limit defaults to 50", () => {
		const p = parse_pagination(new URLSearchParams("limit=abc"))
		expect(p.limit).toBe(50)
	})

	test("non-numeric offset defaults to 0", () => {
		const p = parse_pagination(new URLSearchParams("offset=abc"))
		expect(p.offset).toBe(0)
	})
})
