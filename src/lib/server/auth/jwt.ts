import { SignJWT, jwtVerify } from "jose"

// Cookie + JWT expiry: 30 days (in seconds).
const EXPIRY_SECONDS = 30 * 24 * 60 * 60

function secret_key(secret: string): Uint8Array {
	return new TextEncoder().encode(secret)
}

/** Sign a new session JWT. Returns the compact JWT string. */
export async function sign_session({
	username,
	secret,
}: {
	username: string
	secret: string
}): Promise<string> {
	return new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(username)
		.setIssuedAt()
		.setIssuer("wallrus")
		.setAudience("wallrus")
		.setExpirationTime(`${EXPIRY_SECONDS}s`)
		.sign(secret_key(secret))
}

export type SessionClaims = {
	sub: string
	iat: number
	exp: number
}

/**
 * Verify a session JWT. Returns the claims on success, null on any error
 * (expired, wrong secret, tampered, malformed). Never throws across the boundary —
 * callers convert null → 401.
 */
export async function verify_session(token: string, secret: string): Promise<SessionClaims | null> {
	try {
		const { payload } = await jwtVerify(token, secret_key(secret), {
			issuer: "wallrus",
			audience: "wallrus",
		})
		if (
			typeof payload.sub !== "string" ||
			typeof payload.iat !== "number" ||
			typeof payload.exp !== "number"
		) {
			return null
		}
		return { sub: payload.sub, iat: payload.iat, exp: payload.exp }
	} catch {
		return null
	}
}
