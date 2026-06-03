/**
 * Tests for GET /api/v1/mobile/release/latest and ReleaseLatestSchema.
 */

import { describe, expect, mock, test } from "bun:test"
import {
	ReleaseLatestSchema,
	ReleaseLatestUnconfiguredSchema,
} from "$lib/schemas/mobile/ReleaseLatest"

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("ReleaseLatestSchema", () => {
	test("validates a correct payload", () => {
		const payload = {
			version: "1.2.3",
			sha256: "a".repeat(64),
			url: "https://example.com/wallrus-1.2.3.apk",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.version).toBe("1.2.3")
			expect(result.data.mandatory).toBe(false)
		}
	})

	test("validates mandatory=true", () => {
		const payload = {
			version: "2.0.0",
			sha256: "b".repeat(64),
			url: "https://example.com/wallrus-2.0.0.apk",
			mandatory: true,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(true)
	})

	test("rejects missing version", () => {
		const payload = {
			sha256: "a".repeat(64),
			url: "https://example.com/wallrus.apk",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})

	test("rejects empty version string", () => {
		const payload = {
			version: "",
			sha256: "a".repeat(64),
			url: "https://example.com/wallrus.apk",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})

	test("rejects sha256 shorter than 64 chars", () => {
		const payload = {
			version: "1.0.0",
			sha256: "abc",
			url: "https://example.com/wallrus.apk",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})

	test("rejects sha256 longer than 64 chars", () => {
		const payload = {
			version: "1.0.0",
			sha256: "a".repeat(65),
			url: "https://example.com/wallrus.apk",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})

	test("rejects non-URL url field", () => {
		const payload = {
			version: "1.0.0",
			sha256: "a".repeat(64),
			url: "not-a-url",
			mandatory: false,
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})

	test("rejects missing mandatory field", () => {
		const payload = {
			version: "1.0.0",
			sha256: "a".repeat(64),
			url: "https://example.com/wallrus.apk",
		}
		const result = ReleaseLatestSchema.safeParse(payload)
		expect(result.success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Env-mapping / route handler test
// ---------------------------------------------------------------------------

describe("GET /api/v1/mobile/release/latest — env mapping", () => {
	test("returns configured values when all env vars are set", async () => {
		const expected_sha = "c".repeat(64)

		mock.module("$lib/server/env", () => ({
			env: () => ({
				WALLRUS_MOBILE_RELEASE_VERSION: "1.5.0",
				WALLRUS_MOBILE_RELEASE_SHA256: expected_sha,
				WALLRUS_MOBILE_RELEASE_URL: "https://example.com/wallrus-1.5.0.apk",
				WALLRUS_MOBILE_RELEASE_MANDATORY: true,
			}),
		}))

		const { GET } = await import("./+server")
		const res = await GET({} as Parameters<typeof GET>[0])
		const body = await res.json()

		const parsed = ReleaseLatestSchema.safeParse(body)
		expect(parsed.success).toBe(true)
		if (parsed.success) {
			expect(parsed.data.version).toBe("1.5.0")
			expect(parsed.data.sha256).toBe(expected_sha)
			expect(parsed.data.url).toBe("https://example.com/wallrus-1.5.0.apk")
			expect(parsed.data.mandatory).toBe(true)
		}
	})

	test("returns empty strings when env vars are absent", async () => {
		mock.module("$lib/server/env", () => ({
			env: () => ({
				WALLRUS_MOBILE_RELEASE_VERSION: undefined,
				WALLRUS_MOBILE_RELEASE_SHA256: undefined,
				WALLRUS_MOBILE_RELEASE_URL: undefined,
				WALLRUS_MOBILE_RELEASE_MANDATORY: false,
			}),
		}))

		const { GET } = await import("./+server")
		const res = await GET({} as Parameters<typeof GET>[0])
		const body = await res.json()

		// Use the unconfigured schema (empty strings, no url validation)
		const parsed = ReleaseLatestUnconfiguredSchema.safeParse(body)
		expect(parsed.success).toBe(true)
		if (parsed.success) {
			expect(parsed.data.version).toBe("")
			expect(parsed.data.sha256).toBe("")
			expect(parsed.data.url).toBe("")
			expect(parsed.data.mandatory).toBe(false)
		}
	})
})
