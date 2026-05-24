/**
 * Parse an HTTP `Authorization: Basic …` header.
 *
 * Rules:
 *  - Must start with exactly `Basic ` (case-sensitive, one space).
 *  - The remainder must be valid base64 that decodes to `username:password`.
 *  - The decoded string must contain at least one colon.
 *  - Returns null for anything else: Bearer, Digest, malformed base64,
 *    missing colon, null/empty header.
 */
export function parse_basic(
	header: string | null | undefined,
): { username: string; password: string } | null {
	if (!header) return null
	if (!header.startsWith("Basic ")) return null

	const encoded = header.slice("Basic ".length)
	if (!encoded) return null

	let decoded: string
	try {
		decoded = atob(encoded)
	} catch {
		return null
	}

	// atob silently ignores some malformed input — verify the round-trip.
	if (btoa(decoded) !== encoded) return null

	const colon = decoded.indexOf(":")
	if (colon === -1) return null

	const username = decoded.slice(0, colon)
	const password = decoded.slice(colon + 1)

	return { username, password }
}
