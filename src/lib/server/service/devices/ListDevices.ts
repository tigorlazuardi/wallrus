import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type { ListDevicesRequest, ListDevicesResponse } from "$lib/schemas/devices/ListDevices"
import { devices } from "$lib/server/db/schema"
import { encode_cursor, decode_cursor } from "$lib/server/http/pagination"
import { type Constructor, to_device_dto } from "./base"

export function ListDevices<T extends Constructor>(Sup: T) {
	return class ListDevices extends Sup {
		@traced()
		async listDevices(req: ListDevicesRequest): Promise<ListDevicesResponse> {
			const db = this.deps.db
			const limit = req.limit
			const offset = req.offset

			// Build base filter clause
			const base_where =
				req.enabled !== undefined ? eq(devices.enabled, req.enabled) : undefined

			// Count total under the base filter (no cursor)
			const total_result = await withQueryName("devices.list.count", () =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(devices)
					.where(base_where),
			)
			const total = total_result[0]?.count ?? 0

			// Determine ordering and cursor predicate
			// Primary sort: created_at DESC, id DESC (deterministic `, id` tie-breaker)
			let rows: (typeof devices.$inferSelect)[]

			if (req.next) {
				const cursor = decode_cursor(req.next)
				if (cursor) {
					// Forward: rows AFTER (i.e. created_at/id less than) anchor
					const cursor_where = or(
						lt(devices.created_at, cursor.created_at),
						and(eq(devices.created_at, cursor.created_at), lt(devices.id, cursor.id)),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					rows = await withQueryName("devices.list", () =>
						db
							.select()
							.from(devices)
							.where(where_clause)
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)
				} else {
					rows = await withQueryName("devices.list", () =>
						db
							.select()
							.from(devices)
							.where(base_where)
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else if (req.prev) {
				const cursor = decode_cursor(req.prev)
				if (cursor) {
					// Backward: rows BEFORE (i.e. created_at/id greater than) anchor
					// Order ASC to get them, then reverse in memory
					const cursor_where = or(
						gt(devices.created_at, cursor.created_at),
						and(eq(devices.created_at, cursor.created_at), gt(devices.id, cursor.id)),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					const raw = await withQueryName("devices.list", () =>
						db
							.select()
							.from(devices)
							.where(where_clause)
							.orderBy(asc(devices.created_at), asc(devices.id))
							.limit(limit)
							.offset(offset),
					)
					// Re-reverse to maintain DESC presentation order
					rows = raw.reverse()
				} else {
					rows = await withQueryName("devices.list", () =>
						db
							.select()
							.from(devices)
							.where(base_where)
							.orderBy(desc(devices.created_at), desc(devices.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else {
				// Page 1 — no cursor
				rows = await withQueryName("devices.list", () =>
					db
						.select()
						.from(devices)
						.where(base_where)
						.orderBy(desc(devices.created_at), desc(devices.id))
						.limit(limit)
						.offset(offset),
				)
			}

			const items = rows.map(to_device_dto)

			const first_row = rows[0]
			const last_row = rows[rows.length - 1]

			const next_cursor =
				first_row != null && last_row != null
					? encode_cursor({
							created_at: last_row.created_at,
							id: last_row.id,
						})
					: undefined

			const prev_cursor =
				first_row != null && last_row != null
					? encode_cursor({
							created_at: first_row.created_at,
							id: first_row.id,
						})
					: undefined

			return { items, total, next_cursor, prev_cursor }
		}
	}
}
