import { describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { seed_images, IMG } from "$test/fixtures/seed_images"
import { check } from "./dedup"

// IMG.i17 is blacklisted, IMG.i16 is soft-deleted
// Image source URLs follow the pattern: https://example.com/img/<index>
// (see make_image in seed_images.ts)
const URL_OF = (index: number) => `https://example.com/img/${index}`
const SHA256_OF = (index: number) => `sha256_${index}_${"a".repeat(40 - String(index).length)}`

describe("dedup.check — Stage 1 (source_url lookup)", () => {
	test("URL match + blacklisted → skip_blacklisted", async () => {
		const db = create_test_db()
		seed_images(db)

		// i17 is blacklisted (index 17)
		const result = await check(db, { source_url: URL_OF(17) })

		expect(result.kind).toBe("skip_blacklisted")
		if (result.kind === "skip_blacklisted") {
			expect(result.existing.id).toBe(IMG.i17)
		}
	})

	test("URL match + present + not blacklisted → skip_already_present", async () => {
		const db = create_test_db()
		seed_images(db)

		// i01 is active (not deleted, not blacklisted), index 1
		const result = await check(db, { source_url: URL_OF(1) })

		expect(result.kind).toBe("skip_already_present")
		if (result.kind === "skip_already_present") {
			expect(result.existing.id).toBe(IMG.i01)
		}
	})

	test("URL match + soft-deleted → re_fan_out", async () => {
		const db = create_test_db()
		seed_images(db)

		// i16 is soft-deleted (index 16)
		const result = await check(db, { source_url: URL_OF(16) })

		expect(result.kind).toBe("re_fan_out")
		if (result.kind === "re_fan_out") {
			expect(result.existing.id).toBe(IMG.i16)
			expect(result.existing.deleted_at).not.toBeNull()
		}
	})
})

describe("dedup.check — Stage 2 (sha256 lookup)", () => {
	test("sha256 match across different URL → re_fan_out", async () => {
		const db = create_test_db()
		seed_images(db)

		// Use the sha256 of i01 but with a different (non-existent) source_url
		const sha256_i01 = SHA256_OF(1)
		const result = await check(db, {
			source_url: "https://different.source.example.com/new-image.jpg",
			sha256: sha256_i01,
		})

		expect(result.kind).toBe("re_fan_out")
		if (result.kind === "re_fan_out") {
			expect(result.existing.id).toBe(IMG.i01)
		}
	})

	test("sha256 match of blacklisted image → skip_blacklisted", async () => {
		const db = create_test_db()
		seed_images(db)

		// Use sha256 of i17 (blacklisted) with a different URL
		const sha256_i17 = SHA256_OF(17)
		const result = await check(db, {
			source_url: "https://different.source.example.com/another.jpg",
			sha256: sha256_i17,
		})

		expect(result.kind).toBe("skip_blacklisted")
		if (result.kind === "skip_blacklisted") {
			expect(result.existing.id).toBe(IMG.i17)
		}
	})
})

describe("dedup.check — Stage 3 (nothing matches)", () => {
	test("unknown URL and no sha256 → new", async () => {
		const db = create_test_db()
		seed_images(db)

		const result = await check(db, {
			source_url: "https://brand-new.example.com/unseen.jpg",
		})

		expect(result.kind).toBe("new")
	})

	test("unknown URL and unknown sha256 → new", async () => {
		const db = create_test_db()
		seed_images(db)

		const result = await check(db, {
			source_url: "https://brand-new.example.com/unseen2.jpg",
			sha256: "0000000000000000000000000000000000000000000000000000000000000000",
		})

		expect(result.kind).toBe("new")
	})
})
