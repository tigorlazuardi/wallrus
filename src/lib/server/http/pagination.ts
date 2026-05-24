/**
 * Pagination helpers for wallrus API list endpoints.
 *
 * Cursor encodes `{ created_at: number, id: string }` as base64url JSON.
 * `decode_cursor` returns null on any malformed input — never throws.
 * `parse_pagination` reads URLSearchParams and clamps/defaults all values.
 */

export type Cursor = {
	created_at: number
	id: string
}

export type ParsedPagination = {
	limit: number
	offset: number
	next: string | null
	prev: string | null
}

const LIMIT_DEFAULT = 50
const LIMIT_MIN = 1
const LIMIT_MAX = 200

/**
 * Encode a cursor object to a base64url string.
 */
export function encode_cursor(cursor: Cursor): string {
	const json = JSON.stringify(cursor)
	// Buffer → base64 → strip padding → replace + and / for base64url
	return Buffer.from(json, "utf8")
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")
}

/**
 * Decode a base64url cursor string. Returns null on any parse error.
 */
export function decode_cursor(s: string): Cursor | null {
	try {
		// Restore padding before decoding
		const padded = s + "=".repeat((4 - (s.length % 4)) % 4)
		const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
			"utf8",
		)
		const obj = JSON.parse(json) as unknown
		if (
			typeof obj !== "object" ||
			obj === null ||
			typeof (obj as Record<string, unknown>).created_at !== "number" ||
			typeof (obj as Record<string, unknown>).id !== "string"
		) {
			return null
		}
		return obj as Cursor
	} catch {
		return null
	}
}

/**
 * Parse and normalize pagination query parameters from a URL's search params.
 *
 * - `limit`: clamped to [1, 200], default 50
 * - `offset`: non-negative integer, default 0
 * - `next`/`prev`: raw cursor strings (not decoded here; callers decode as needed)
 * - If both `next` and `prev` are present, `next` wins (`prev` is set to null)
 */
export function parse_pagination(params: URLSearchParams): ParsedPagination {
	const raw_limit = params.get("limit")
	const raw_offset = params.get("offset")
	const raw_next = params.get("next")
	const raw_prev = params.get("prev")

	let limit = raw_limit !== null ? parseInt(raw_limit, 10) : LIMIT_DEFAULT
	if (isNaN(limit)) limit = LIMIT_DEFAULT
	if (limit < LIMIT_MIN) limit = LIMIT_MIN
	if (limit > LIMIT_MAX) limit = LIMIT_MAX

	let offset = raw_offset !== null ? parseInt(raw_offset, 10) : 0
	if (isNaN(offset)) offset = 0
	if (offset < 0) offset = 0

	const next = raw_next !== null && raw_next.length > 0 ? raw_next : null
	// next wins when both are present
	const prev = next !== null ? null : raw_prev !== null && raw_prev.length > 0 ? raw_prev : null

	return { limit, offset, next, prev }
}
