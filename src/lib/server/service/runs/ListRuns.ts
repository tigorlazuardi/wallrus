import { and, asc, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type { ListRunsRequest, ListRunsResponse } from "$lib/schemas/runs/ListRuns"
import { run_history } from "$lib/server/db/schema"
import { type Constructor, to_run_dto } from "./base"

// ---------------------------------------------------------------------------
// Cursor helpers (started_at-based, separate from devices' created_at cursor)
// ---------------------------------------------------------------------------

type RunCursor = { started_at: number; id: string }

function encode_run_cursor(c: RunCursor): string {
	const json = JSON.stringify(c)
	return Buffer.from(json, "utf8")
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")
}

function decode_run_cursor(s: string): RunCursor | null {
	try {
		const padded = s + "=".repeat((4 - (s.length % 4)) % 4)
		const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
			"utf8",
		)
		const obj = JSON.parse(json) as unknown
		if (
			typeof obj !== "object" ||
			obj === null ||
			typeof (obj as Record<string, unknown>).started_at !== "number" ||
			typeof (obj as Record<string, unknown>).id !== "string"
		) {
			return null
		}
		return obj as RunCursor
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// ListRuns mixin
// ---------------------------------------------------------------------------

export function ListRuns<T extends Constructor>(Sup: T) {
	return class ListRuns extends Sup {
		@traced()
		async listRuns(req: ListRunsRequest): Promise<ListRunsResponse> {
			const db = this.deps.db
			const { limit, offset } = req

			// Base filter: subscription_id?, status?, since?, until?
			const raw_conditions = [
				req.subscription_id !== undefined
					? eq(run_history.subscription_id, req.subscription_id)
					: undefined,
				req.status !== undefined ? eq(run_history.status, req.status) : undefined,
				req.since !== undefined ? gte(run_history.started_at, req.since) : undefined,
				req.until !== undefined ? lt(run_history.started_at, req.until) : undefined,
			]
			const base_conditions = raw_conditions.filter(
				(c): c is NonNullable<(typeof raw_conditions)[number]> => c !== undefined,
			)

			const base_where = base_conditions.length > 0 ? and(...base_conditions) : undefined

			// Count total
			const total_result = await withQueryName("runs.list.count", () =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(run_history)
					.where(base_where),
			)
			const total = total_result[0]?.count ?? 0

			let rows: (typeof run_history.$inferSelect)[]

			if (req.next) {
				const cursor = decode_run_cursor(req.next)
				if (cursor) {
					const cursor_where = or(
						lt(run_history.started_at, cursor.started_at),
						and(
							eq(run_history.started_at, cursor.started_at),
							lt(run_history.id, cursor.id),
						),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					rows = await withQueryName("runs.list", () =>
						db
							.select()
							.from(run_history)
							.where(where_clause)
							.orderBy(desc(run_history.started_at), desc(run_history.id))
							.limit(limit)
							.offset(offset),
					)
				} else {
					rows = await withQueryName("runs.list", () =>
						db
							.select()
							.from(run_history)
							.where(base_where)
							.orderBy(desc(run_history.started_at), desc(run_history.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else if (req.prev) {
				const cursor = decode_run_cursor(req.prev)
				if (cursor) {
					const cursor_where = or(
						lte(run_history.started_at, cursor.started_at),
						and(
							eq(run_history.started_at, cursor.started_at),
							lte(run_history.id, cursor.id),
						),
					)
					const where_clause = base_where ? and(base_where, cursor_where) : cursor_where
					const raw = await withQueryName("runs.list", () =>
						db
							.select()
							.from(run_history)
							.where(where_clause)
							.orderBy(asc(run_history.started_at), asc(run_history.id))
							.limit(limit)
							.offset(offset),
					)
					rows = raw.reverse()
				} else {
					rows = await withQueryName("runs.list", () =>
						db
							.select()
							.from(run_history)
							.where(base_where)
							.orderBy(desc(run_history.started_at), desc(run_history.id))
							.limit(limit)
							.offset(offset),
					)
				}
			} else {
				rows = await withQueryName("runs.list", () =>
					db
						.select()
						.from(run_history)
						.where(base_where)
						.orderBy(desc(run_history.started_at), desc(run_history.id))
						.limit(limit)
						.offset(offset),
				)
			}

			const items = rows.map(to_run_dto)
			const first_row = rows[0]
			const last_row = rows[rows.length - 1]

			const next_cursor =
				first_row != null && last_row != null
					? encode_run_cursor({ started_at: last_row.started_at, id: last_row.id })
					: undefined

			const prev_cursor =
				first_row != null && last_row != null
					? encode_run_cursor({ started_at: first_row.started_at, id: first_row.id })
					: undefined

			return { items, total, next_cursor, prev_cursor }
		}
	}
}
