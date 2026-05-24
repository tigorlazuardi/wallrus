import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type {
	ListSubscriptionsRequest,
	ListSubscriptionsResponse,
} from "$lib/schemas/subscriptions/ListSubscriptions"
import { subscriptions } from "$lib/server/db/schema"
import { encode_cursor, decode_cursor } from "$lib/server/http/pagination"
import { type Constructor, to_subscription_dto } from "./base"

export function ListSubscriptions<T extends Constructor>(Sup: T) {
	return class ListSubscriptions extends Sup {
		@traced()
		async listSubscriptions(req: ListSubscriptionsRequest): Promise<ListSubscriptionsResponse> {
			const db = this.deps.db
			const limit = req.limit
			const offset = req.offset

			// Build base filter clauses
			const filters = []
			if (!req.include_deleted) {
				filters.push(isNull(subscriptions.deleted_at))
			}
			if (req.enabled !== undefined) {
				filters.push(eq(subscriptions.enabled, req.enabled))
			}
			if (req.source_slug !== undefined) {
				filters.push(eq(subscriptions.source_slug, req.source_slug))
			}

			const base_where = filters.length > 0 ? and(...filters) : undefined

			// Count total under the base filter (no cursor)
			const total_result = await withQueryName("subscriptions.list.count", () =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(subscriptions)
					.where(base_where),
			)
			const total = total_result[0]?.count ?? 0

			let rows: (typeof subscriptions.$inferSelect)[]

			if (req.next) {
				const cursor = decode_cursor(req.next)
				if (cursor) {
					const cursor_where = or(
						lt(subscriptions.created_at, cursor.created_at),
						and(
							eq(subscriptions.created_at, cursor.created_at),
							lt(subscriptions.id, cursor.id),
						),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					rows = await withQueryName("subscriptions.list", () =>
						db
							.select()
							.from(subscriptions)
							.where(where_clause)
							.orderBy(desc(subscriptions.created_at), desc(subscriptions.id))
							.limit(limit)
							.offset(offset),
					)
				} else {
					rows = await withQueryName("subscriptions.list", () =>
						db
							.select()
							.from(subscriptions)
							.where(base_where)
							.orderBy(desc(subscriptions.created_at), desc(subscriptions.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else if (req.prev) {
				const cursor = decode_cursor(req.prev)
				if (cursor) {
					const cursor_where = or(
						gt(subscriptions.created_at, cursor.created_at),
						and(
							eq(subscriptions.created_at, cursor.created_at),
							gt(subscriptions.id, cursor.id),
						),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					const raw = await withQueryName("subscriptions.list", () =>
						db
							.select()
							.from(subscriptions)
							.where(where_clause)
							.orderBy(asc(subscriptions.created_at), asc(subscriptions.id))
							.limit(limit)
							.offset(offset),
					)
					rows = raw.reverse()
				} else {
					rows = await withQueryName("subscriptions.list", () =>
						db
							.select()
							.from(subscriptions)
							.where(base_where)
							.orderBy(desc(subscriptions.created_at), desc(subscriptions.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else {
				rows = await withQueryName("subscriptions.list", () =>
					db
						.select()
						.from(subscriptions)
						.where(base_where)
						.orderBy(desc(subscriptions.created_at), desc(subscriptions.id))
						.limit(limit)
						.offset(offset),
				)
			}

			const items = rows.map(to_subscription_dto)
			const first_row = rows[0]
			const last_row = rows[rows.length - 1]

			const next_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: last_row.created_at, id: last_row.id })
					: undefined

			const prev_cursor =
				first_row != null && last_row != null
					? encode_cursor({ created_at: first_row.created_at, id: first_row.id })
					: undefined

			return { items, total, next_cursor, prev_cursor }
		}
	}
}
