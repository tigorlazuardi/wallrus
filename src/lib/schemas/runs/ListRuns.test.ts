import { describe, expect, test } from "bun:test"
import { ListRunsRequestSchema } from "./ListRuns"

describe("ListRunsRequestSchema", () => {
	test("parses default (empty) request", () => {
		const result = ListRunsRequestSchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.offset).toBe(0)
			expect(result.data.limit).toBe(50)
		}
	})

	test("parses with all optional filters", () => {
		const result = ListRunsRequestSchema.safeParse({
			subscription_id: "018f9d5a-8c3e-7a2b-9d4e-5f6a7b8c9d0e",
			status: "running",
			since: 1_700_000_000_000,
			until: 1_800_000_000_000,
			limit: 10,
			offset: 0,
		})
		expect(result.success).toBe(true)
	})

	test("parses cursor pagination fields", () => {
		const result = ListRunsRequestSchema.safeParse({
			next: "abc123",
			limit: 20,
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.next).toBe("abc123")
		}
	})

	test("rejects invalid status", () => {
		const result = ListRunsRequestSchema.safeParse({ status: "pending" })
		expect(result.success).toBe(false)
	})

	test("rejects unknown keys (strict)", () => {
		const result = ListRunsRequestSchema.safeParse({ unknown_field: "oops" })
		expect(result.success).toBe(false)
	})

	test("rejects invalid subscription_id (not uuid)", () => {
		const result = ListRunsRequestSchema.safeParse({ subscription_id: "not-a-uuid" })
		expect(result.success).toBe(false)
	})
})
