/**
 * Convert an arbitrary string to a URL-safe slug.
 *
 * Algorithm:
 *   1. NFKD normalize (decomposes combined characters)
 *   2. Strip combining diacritics (Unicode category Mn)
 *   3. Lowercase
 *   4. Replace runs of non-alphanumeric characters with a single `-`
 *   5. Trim leading/trailing `-`
 *   6. Truncate at 64 characters
 *
 * Pure function — no Svelte imports, no side effects.
 */
export function slugify(input: string): string {
	if (input.length === 0) return ""

	const normalized = input
		.normalize("NFKD")
		// Strip combining diacritics (Unicode category Mn)
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		// Replace runs of non-alphanumeric characters with `-`
		.replace(/[^a-z0-9]+/g, "-")
		// Trim leading/trailing `-`
		.replace(/^-+|-+$/g, "")

	return normalized.slice(0, 64)
}
