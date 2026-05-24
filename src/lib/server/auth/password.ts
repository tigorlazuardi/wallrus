/**
 * Verify a plaintext password against an argon2id hash produced by
 * `Bun.password.hash`. Bun auto-detects the algorithm from the hash prefix,
 * so no explicit algorithm is needed here.
 */
export async function verify_password(plaintext: string, hash: string): Promise<boolean> {
	return Bun.password.verify(plaintext, hash)
}
