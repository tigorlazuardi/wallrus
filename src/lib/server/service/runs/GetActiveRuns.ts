import { desc, eq, sql } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import type { GetActiveRunsRequest, GetActiveRunsResponse } from "$lib/schemas/runs/GetActiveRuns"
import { run_history } from "$lib/server/db/schema"
import { type Constructor, to_run_dto } from "./base"

export function GetActiveRuns<T extends Constructor>(Sup: T) {
	return class GetActiveRuns extends Sup {
		@traced()
		async getActiveRuns(_req: GetActiveRunsRequest): Promise<GetActiveRunsResponse> {
			const db = this.deps.db

			const rows = await withQueryName("runs.active", () =>
				db
					.select()
					.from(run_history)
					.where(eq(run_history.status, "running"))
					.orderBy(desc(run_history.started_at), desc(run_history.id))
					.limit(100),
			)

			const total_result = await withQueryName("runs.active.count", () =>
				db
					.select({ count: sql<number>`COUNT(*)` })
					.from(run_history)
					.where(eq(run_history.status, "running")),
			)

			const total = total_result[0]?.count ?? 0

			return { items: rows.map(to_run_dto), total }
		}
	}
}
