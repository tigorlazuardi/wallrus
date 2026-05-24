/**
 * Three-stage dedup check for the ingest pipeline.
 *
 * Stage 1 (pre-download, no sha256): lookup by source_url.
 *   - Found + blacklisted_at IS NOT NULL  → skip_blacklisted
 *   - Found + deleted_at IS NOT NULL       → re_fan_out  (soft-deleted; re-download + re-fanout)
 *   - Found + active (not deleted, not blacklisted) → skip_already_present
 *
 * Stage 2 (post-download, sha256 present): lookup by sha256.
 *   - Found + blacklisted_at IS NOT NULL  → skip_blacklisted
 *   - Found (any state)                   → re_fan_out  (same content, different source_url)
 *
 * Stage 3: nothing matches → new
 */

import { eq } from "drizzle-orm"
import { images, type Image } from "$lib/server/db/schema"
import type { DbClient } from "$lib/server/db/client"

// ---------------------------------------------------------------------------
// Return type — discriminated union
// ---------------------------------------------------------------------------

export type DedupResult =
	| { kind: "skip_blacklisted"; existing: Image }
	| { kind: "skip_already_present"; existing: Image }
	| { kind: "re_fan_out"; existing: Image }
	| { kind: "new" }

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

export type DedupCandidate = {
	source_url: string
	/** Present only in Stage 2 (post-download). */
	sha256?: string
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

/**
 * Run the three-stage dedup check and return a discriminated result.
 *
 * Call with `sha256: undefined` before downloading to get a cheap Stage 1
 * check. Call again with the computed `sha256` after downloading to run
 * Stage 2 (content-hash dedup across different source URLs).
 */
export async function check(db: DbClient, candidate: DedupCandidate): Promise<DedupResult> {
	// Stage 1 — lookup by source_url (cheap, always run)
	const by_url = await db.query.images.findFirst({
		where: eq(images.source_url, candidate.source_url),
	})

	if (by_url !== undefined) {
		if (by_url.blacklisted_at !== null) {
			return { kind: "skip_blacklisted", existing: by_url }
		}
		if (by_url.deleted_at !== null) {
			// Soft-deleted: re-download and re-fan-out to restore the image.
			return { kind: "re_fan_out", existing: by_url }
		}
		// Active, not blacklisted — already present.
		return { kind: "skip_already_present", existing: by_url }
	}

	// Stage 2 — lookup by sha256 (only when sha256 provided, i.e. post-download)
	if (candidate.sha256 !== undefined) {
		const by_hash = await db.query.images.findFirst({
			where: eq(images.sha256, candidate.sha256),
		})

		if (by_hash !== undefined) {
			if (by_hash.blacklisted_at !== null) {
				return { kind: "skip_blacklisted", existing: by_hash }
			}
			// Same content, different source_url — fan-out only, no new image row.
			return { kind: "re_fan_out", existing: by_hash }
		}
	}

	// Stage 3 — genuinely new
	return { kind: "new" }
}
