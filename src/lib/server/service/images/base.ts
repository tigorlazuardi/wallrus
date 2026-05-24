/**
 * ImageServiceBase — the root class extended by all image operation mixins.
 */
import { eq, inArray } from "drizzle-orm"
import { images, favorites, image_user_tags } from "$lib/server/db/schema"
import type { Image } from "$lib/schemas/images/Image"
import { Base, type Constructor, type Dependencies } from "../base"

export { Base, type Constructor, type Dependencies }

/**
 * Raw row shape returned by the enriched image query (LEFT JOIN favorites + aggregated tags).
 * All fields are from the `images` table plus derived `favorited`.
 */
export type ImageRow = typeof images.$inferSelect & {
	favorited: number // 0 or 1 (SQLite boolean from IS NOT NULL check)
}

/** Convert a raw ImageRow + user tags array to an Image DTO. */
export function to_image_dto(row: ImageRow, tags_user: string[]): Image {
	return {
		id: row.id,
		sha256: row.sha256,
		source_slug: row.source_slug,
		source_id: row.source_id,
		source_url: row.source_url,
		image_url: row.image_url,
		title: row.title,
		filename: row.filename,
		width: row.width,
		height: row.height,
		file_size: row.file_size,
		format: row.format as Image["format"],
		nsfw: row.nsfw as Image["nsfw"],
		tags_source: row.tags_source,
		tags_user,
		search_text: row.search_text ?? null,
		created_at_source: row.created_at_source ?? null,
		ingested_at: row.ingested_at,
		deleted_at: row.deleted_at ?? null,
		blacklisted_at: row.blacklisted_at ?? null,
		aspect_ratio: row.aspect_ratio ?? null,
		favorited: row.favorited === 1,
	}
}

/**
 * Fetch user tags for a single image ID.
 */
export async function fetch_tags_user(db: Dependencies["db"], image_id: string): Promise<string[]> {
	const rows = await db
		.select({ tag: image_user_tags.tag })
		.from(image_user_tags)
		.where(eq(image_user_tags.image_id, image_id))
	return rows.map((r) => r.tag)
}

/**
 * Fetch user tags for multiple image IDs in one query.
 * Returns a Map<image_id, string[]>.
 */
export async function fetch_tags_user_bulk(
	db: Dependencies["db"],
	image_ids: string[],
): Promise<Map<string, string[]>> {
	if (image_ids.length === 0) return new Map()

	const rows = await db
		.select({ image_id: image_user_tags.image_id, tag: image_user_tags.tag })
		.from(image_user_tags)
		.where(inArray(image_user_tags.image_id, image_ids))

	const out = new Map<string, string[]>()
	for (const id of image_ids) out.set(id, [])
	for (const r of rows) {
		const arr = out.get(r.image_id)
		if (arr) arr.push(r.tag)
	}
	return out
}

export { images, favorites, image_user_tags }
