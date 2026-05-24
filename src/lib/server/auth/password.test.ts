import { describe, expect, test } from "bun:test"
import { verify_password } from "./password"

describe("verify_password", () => {
	test("matching plaintext → true", async () => {
		const hash = await Bun.password.hash("correct_password", { algorithm: "argon2id" })
		const result = await verify_password("correct_password", hash)
		expect(result).toBe(true)
	})

	test("mismatching plaintext → false", async () => {
		const hash = await Bun.password.hash("correct_password", { algorithm: "argon2id" })
		const result = await verify_password("wrong_password", hash)
		expect(result).toBe(false)
	})
})
