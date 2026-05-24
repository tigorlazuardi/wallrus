import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type { ListImagesRequest, ListImagesResponse } from "$lib/schemas/images/ListImages"
import { device_images, favorites } from "$lib/server/db/schema"
import { encode_cursor, decode_cursor } from "$lib/server/http/pagination"
import { type Constructor, type ImageRow, images, to_image_dto, fetch_tags_user_bulk } from "./base"

// The FTS5 virtual table name (confirmed from drizzle/migrations/0001_fts5_search_text.sql)
const FTS_TABLE = "images_fts"

export function ListImages<T extends Constructor>(Sup: T) {
	return class ListImages extends Sup {
		@traced()
		async listImages(req: ListImagesRequest): Promise<ListImagesResponse> {
			const db = this.deps.db
			const limit = req.limit
			const offset = req.offset

			// Build filter clauses
			const filter_parts: ReturnType<typeof eq>[] = []

			// Soft-delete filter (default: exclude deleted)
			if (!req.include_deleted) {
				filter_parts.push(isNull(images.deleted_at) as ReturnType<typeof eq>)
			}

			// Blacklist filter (default: exclude blacklisted)
			if (!req.include_blacklisted) {
				filter_parts.push(isNull(images.blacklisted_at) as ReturnType<typeof eq>)
			}

			// source_slug filter
			if (req.source_slug !== undefined) {
				filter_parts.push(eq(images.source_slug, req.source_slug) as ReturnType<typeof eq>)
			}

			// nsfw filter per reconciliation: sfw='sfw', nsfw='nsfw', all=no filter
			if (req.nsfw === "sfw_only") {
				filter_parts.push(eq(images.nsfw, "sfw") as ReturnType<typeof eq>)
			} else if (req.nsfw === "nsfw_only") {
				filter_parts.push(eq(images.nsfw, "nsfw") as ReturnType<typeof eq>)
			}
			// 'all' or undefined: no filter

			// device_id filter via IN-subquery
			if (req.device_id !== undefined) {
				filter_parts.push(
					sql`${images.id} IN (SELECT image_id FROM ${device_images} WHERE ${device_images.device_id} = ${req.device_id})` as unknown as ReturnType<
						typeof eq
					>,
				)
			}

			// favorited filter via EXISTS/NOT EXISTS
			if (req.favorited === true) {
				filter_parts.push(
					sql`${images.id} IN (SELECT image_id FROM ${favorites})` as unknown as ReturnType<
						typeof eq
					>,
				)
			} else if (req.favorited === false) {
				filter_parts.push(
					sql`${images.id} NOT IN (SELECT image_id FROM ${favorites})` as unknown as ReturnType<
						typeof eq
					>,
				)
			}

			// FTS search via rowid IN-subquery
			// Qualify with table name "images.rowid" to avoid ambiguity with the LEFT JOIN to favorites
			const has_search = req.search !== undefined && req.search.trim().length > 0
			if (has_search) {
				filter_parts.push(
					sql`images.rowid IN (SELECT rowid FROM ${sql.raw(FTS_TABLE)} WHERE ${sql.raw(FTS_TABLE)} MATCH ${req.search})` as unknown as ReturnType<
						typeof eq
					>,
				)
			}

			// Combine all filter parts
			const base_where = filter_parts.length > 0 ? and(...filter_parts) : undefined

			// Count total (no cursor)
			const total_result = await withQueryName("images.list.count", () =>
				db
					.select({
						count: sql<number>`COUNT(*)`,
					})
					.from(images)
					.where(base_where),
			)
			const total = total_result[0]?.count ?? 0

			// Determine ordering + fetch rows
			let rows: ImageRow[]

			if (has_search) {
				// FTS search: order by bm25 ASC (negative scores; least-negative = best)
				// bm25 is computed via subquery correlating rowid
				const bm25_order = sql`(SELECT bm25(${sql.raw(FTS_TABLE)}) FROM ${sql.raw(FTS_TABLE)} WHERE ${sql.raw(FTS_TABLE)}.rowid = images.rowid)`

				rows = (await withQueryName("images.list.search", () =>
					db
						.select({
							id: images.id,
							sha256: images.sha256,
							source_slug: images.source_slug,
							source_id: images.source_id,
							source_url: images.source_url,
							image_url: images.image_url,
							title: images.title,
							filename: images.filename,
							width: images.width,
							height: images.height,
							file_size: images.file_size,
							format: images.format,
							nsfw: images.nsfw,
							tags_source: images.tags_source,
							search_text: images.search_text,
							created_at_source: images.created_at_source,
							ingested_at: images.ingested_at,
							deleted_at: images.deleted_at,
							blacklisted_at: images.blacklisted_at,
							aspect_ratio: images.aspect_ratio,
							favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
						})
						.from(images)
						.leftJoin(favorites, eq(favorites.image_id, images.id))
						.where(base_where)
						.orderBy(asc(bm25_order), asc(images.id))
						.limit(limit)
						.offset(offset),
				)) as ImageRow[]
			} else if (req.next) {
				// Forward pagination cursor
				const cursor = decode_cursor(req.next)
				if (cursor) {
					// cursor.created_at holds ingested_at value (reuse existing Cursor type)
					const cursor_where = or(
						lt(images.ingested_at, cursor.created_at),
						and(eq(images.ingested_at, cursor.created_at), lt(images.id, cursor.id)),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where

					rows = (await withQueryName("images.list", () =>
						db
							.select({
								id: images.id,
								sha256: images.sha256,
								source_slug: images.source_slug,
								source_id: images.source_id,
								source_url: images.source_url,
								image_url: images.image_url,
								title: images.title,
								filename: images.filename,
								width: images.width,
								height: images.height,
								file_size: images.file_size,
								format: images.format,
								nsfw: images.nsfw,
								tags_source: images.tags_source,
								search_text: images.search_text,
								created_at_source: images.created_at_source,
								ingested_at: images.ingested_at,
								deleted_at: images.deleted_at,
								blacklisted_at: images.blacklisted_at,
								aspect_ratio: images.aspect_ratio,
								favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
							})
							.from(images)
							.leftJoin(favorites, eq(favorites.image_id, images.id))
							.where(where_clause)
							.orderBy(desc(images.ingested_at), desc(images.id))
							.limit(limit)
							.offset(offset),
					)) as ImageRow[]
				} else {
					rows = (await withQueryName("images.list", () =>
						db
							.select({
								id: images.id,
								sha256: images.sha256,
								source_slug: images.source_slug,
								source_id: images.source_id,
								source_url: images.source_url,
								image_url: images.image_url,
								title: images.title,
								filename: images.filename,
								width: images.width,
								height: images.height,
								file_size: images.file_size,
								format: images.format,
								nsfw: images.nsfw,
								tags_source: images.tags_source,
								search_text: images.search_text,
								created_at_source: images.created_at_source,
								ingested_at: images.ingested_at,
								deleted_at: images.deleted_at,
								blacklisted_at: images.blacklisted_at,
								aspect_ratio: images.aspect_ratio,
								favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
							})
							.from(images)
							.leftJoin(favorites, eq(favorites.image_id, images.id))
							.where(base_where)
							.orderBy(desc(images.ingested_at), desc(images.id))
							.limit(limit)
							.offset(offset),
					)) as ImageRow[]
				}
			} else if (req.prev) {
				// Backward pagination cursor
				const cursor = decode_cursor(req.prev)
				if (cursor) {
					const cursor_where = or(
						gt(images.ingested_at, cursor.created_at),
						and(eq(images.ingested_at, cursor.created_at), gt(images.id, cursor.id)),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where

					const raw = await withQueryName("images.list", () =>
						db
							.select({
								id: images.id,
								sha256: images.sha256,
								source_slug: images.source_slug,
								source_id: images.source_id,
								source_url: images.source_url,
								image_url: images.image_url,
								title: images.title,
								filename: images.filename,
								width: images.width,
								height: images.height,
								file_size: images.file_size,
								format: images.format,
								nsfw: images.nsfw,
								tags_source: images.tags_source,
								search_text: images.search_text,
								created_at_source: images.created_at_source,
								ingested_at: images.ingested_at,
								deleted_at: images.deleted_at,
								blacklisted_at: images.blacklisted_at,
								aspect_ratio: images.aspect_ratio,
								favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
							})
							.from(images)
							.leftJoin(favorites, eq(favorites.image_id, images.id))
							.where(where_clause)
							.orderBy(asc(images.ingested_at), asc(images.id))
							.limit(limit)
							.offset(offset),
					)
					rows = (raw as ImageRow[]).reverse()
				} else {
					rows = (await withQueryName("images.list", () =>
						db
							.select({
								id: images.id,
								sha256: images.sha256,
								source_slug: images.source_slug,
								source_id: images.source_id,
								source_url: images.source_url,
								image_url: images.image_url,
								title: images.title,
								filename: images.filename,
								width: images.width,
								height: images.height,
								file_size: images.file_size,
								format: images.format,
								nsfw: images.nsfw,
								tags_source: images.tags_source,
								search_text: images.search_text,
								created_at_source: images.created_at_source,
								ingested_at: images.ingested_at,
								deleted_at: images.deleted_at,
								blacklisted_at: images.blacklisted_at,
								aspect_ratio: images.aspect_ratio,
								favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
							})
							.from(images)
							.leftJoin(favorites, eq(favorites.image_id, images.id))
							.where(base_where)
							.orderBy(desc(images.ingested_at), desc(images.id))
							.limit(limit)
							.offset(offset),
					)) as ImageRow[]
				}
			} else {
				// Page 1 — no cursor
				rows = (await withQueryName("images.list", () =>
					db
						.select({
							id: images.id,
							sha256: images.sha256,
							source_slug: images.source_slug,
							source_id: images.source_id,
							source_url: images.source_url,
							image_url: images.image_url,
							title: images.title,
							filename: images.filename,
							width: images.width,
							height: images.height,
							file_size: images.file_size,
							format: images.format,
							nsfw: images.nsfw,
							tags_source: images.tags_source,
							search_text: images.search_text,
							created_at_source: images.created_at_source,
							ingested_at: images.ingested_at,
							deleted_at: images.deleted_at,
							blacklisted_at: images.blacklisted_at,
							aspect_ratio: images.aspect_ratio,
							favorited: sql<number>`(${favorites.image_id} IS NOT NULL)`,
						})
						.from(images)
						.leftJoin(favorites, eq(favorites.image_id, images.id))
						.where(base_where)
						.orderBy(desc(images.ingested_at), desc(images.id))
						.limit(limit)
						.offset(offset),
				)) as ImageRow[]
			}

			// Bulk-fetch user tags for all returned rows
			const image_ids = rows.map((r) => r.id)
			const tags_map = await fetch_tags_user_bulk(db, image_ids)

			const items = rows.map((row) => to_image_dto(row, tags_map.get(row.id) ?? []))

			const first_row = rows[0]
			const last_row = rows[rows.length - 1]

			const next_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: last_row.ingested_at, id: last_row.id })
					: undefined

			const prev_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: first_row.ingested_at, id: first_row.id })
					: undefined

			return { items, total, next_cursor, prev_cursor }
		}
	}
}
