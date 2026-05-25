/**
 * Pure filter evaluation — no I/O, no DB, no side effects.
 *
 * Evaluates a candidate image's metadata against a device's filter criteria
 * and returns a pass/fail result with the first failing criterion reason.
 *
 * Field names mirror `DeviceFilterCriteria` in `db/schema.ts` and
 * `DeviceFiltersSchema` in `$lib/schemas/devices/DeviceFilters.ts`.
 */

import type { DeviceFilterCriteria } from "$lib/server/db/schema"

export type ImageMeta = {
	width: number
	height: number
	file_size: number
	format: string
	tags: string[]
	nsfw: "sfw" | "nsfw" | "unknown"
}

export type FilterResult = { pass: true } | { pass: false; reason: string }

/**
 * Evaluate `image` against device `criteria`.
 *
 * Returns `{ pass: true }` when all criteria are satisfied (or absent).
 * Returns `{ pass: false, reason }` on the first failing criterion.
 * Empty / default criteria (only `nsfw: "all"`) always pass.
 *
 * Evaluation order (cheapest checks first):
 *   1. NSFW
 *   2. Format allowlist
 *   3. Resolution min/max
 *   4. Aspect ratio
 *   5. File size
 *   6. Tags exclude (exclude wins on conflict with include)
 *   7. Tags include
 */
export function evaluate(image: ImageMeta, criteria: DeviceFilterCriteria): FilterResult {
	// 1. NSFW
	if (criteria.nsfw === "sfw_only" && image.nsfw !== "sfw") {
		return { pass: false, reason: "nsfw" }
	}
	if (criteria.nsfw === "nsfw_only" && image.nsfw !== "nsfw") {
		return { pass: false, reason: "nsfw" }
	}

	// 2. Format allowlist
	if (criteria.formats !== undefined && criteria.formats.length > 0) {
		if (!criteria.formats.includes(image.format as "jpg" | "png" | "webp" | "avif")) {
			return { pass: false, reason: "format" }
		}
	}

	// 3. Resolution — minimum
	if (criteria.min_width !== undefined && image.width < criteria.min_width) {
		return { pass: false, reason: "min_width" }
	}
	if (criteria.min_height !== undefined && image.height < criteria.min_height) {
		return { pass: false, reason: "min_height" }
	}

	// 3. Resolution — maximum
	if (criteria.max_width !== undefined && image.width > criteria.max_width) {
		return { pass: false, reason: "max_width" }
	}
	if (criteria.max_height !== undefined && image.height > criteria.max_height) {
		return { pass: false, reason: "max_height" }
	}

	// 4. Aspect ratio
	if (criteria.aspect_ratio !== undefined) {
		const { target, tolerance } = criteria.aspect_ratio
		if (target > 0) {
			const actual_ratio = image.width / image.height
			if (Math.abs(actual_ratio / target - 1) > tolerance) {
				return { pass: false, reason: "aspect_ratio" }
			}
		}
		// target <= 0 is invalid — skip AR check (no opinion)
	}

	// 5. File size
	if (criteria.min_bytes !== undefined && image.file_size < criteria.min_bytes) {
		return { pass: false, reason: "min_bytes" }
	}
	if (criteria.max_bytes !== undefined && image.file_size > criteria.max_bytes) {
		return { pass: false, reason: "max_bytes" }
	}

	// 6. Tags exclude (checked before include so exclude always wins)
	if (criteria.tags_exclude !== undefined && criteria.tags_exclude.length > 0) {
		const lower_tags = image.tags.map((t) => t.toLowerCase())
		for (const excluded of criteria.tags_exclude) {
			if (lower_tags.includes(excluded.toLowerCase())) {
				return { pass: false, reason: "tags_exclude" }
			}
		}
	}

	// 7. Tags include — image must contain ALL listed tags
	if (criteria.tags_include !== undefined && criteria.tags_include.length > 0) {
		const lower_tags = image.tags.map((t) => t.toLowerCase())
		for (const required of criteria.tags_include) {
			if (!lower_tags.includes(required.toLowerCase())) {
				return { pass: false, reason: "tags_include" }
			}
		}
	}

	return { pass: true }
}
