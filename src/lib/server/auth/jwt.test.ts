import { describe, expect, test } from "bun:test"
import { sign_session, verify_session } from "./jwt"
import { SignJWT } from "jose"

const SECRET = "test_secret_at_least_32_bytes_long!!"
const USERNAME = "alice"

describe("sign_session + verify_session", () => {
	test("roundtrip: signed token verifies and returns claims", async () => {
		const token = await sign_session({ username: USERNAME, secret: SECRET })
		expect(typeof token).toBe("string")

		const claims = await verify_session(token, SECRET)
		expect(claims).not.toBeNull()
		expect(claims!.sub).toBe(USERNAME)
		expect(typeof claims!.iat).toBe("number")
		expect(typeof claims!.exp).toBe("number")
		// exp should be ~30 days from now
		const diff = claims!.exp - claims!.iat
		const thirty_days = 30 * 24 * 60 * 60
		expect(diff).toBeGreaterThanOrEqual(thirty_days - 5)
		expect(diff).toBeLessThanOrEqual(thirty_days + 5)
	})

	test("expired token → null", async () => {
		// Manually craft a token that expired 1 second ago.
		const key = new TextEncoder().encode(SECRET)
		const expired = await new SignJWT({})
			.setProtectedHeader({ alg: "HS256" })
			.setSubject(USERNAME)
			.setIssuedAt()
			.setIssuer("wallrus")
			.setAudience("wallrus")
			.setExpirationTime("-1s")
			.sign(key)

		const claims = await verify_session(expired, SECRET)
		expect(claims).toBeNull()
	})

	test("wrong secret → null", async () => {
		const token = await sign_session({ username: USERNAME, secret: SECRET })
		const claims = await verify_session(token, "completely_different_secret_value!!")
		expect(claims).toBeNull()
	})

	test("tampered token → null", async () => {
		const token = await sign_session({ username: USERNAME, secret: SECRET })
		// Replace the entire signature with a plausible-looking but wrong one.
		const parts = token.split(".")
		// Create a fake signature: repeat "x" padded to same-ish length.
		const orig_sig = parts[2] ?? ""
		const fake_sig = "x".repeat(orig_sig.length)
		const tampered = `${parts[0]}.${parts[1]}.${fake_sig}`
		const claims = await verify_session(tampered, SECRET)
		expect(claims).toBeNull()
	})
})
