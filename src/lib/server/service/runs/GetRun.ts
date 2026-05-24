import { eq } from "drizzle-orm"
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { GetRunRequest, GetRunResponse } from "$lib/schemas/runs/GetRun"
import { run_history } from "$lib/server/db/schema"
import { type Constructor, to_run_dto } from "./base"

export function GetRun<T extends Constructor>(Sup: T) {
	return class GetRun extends Sup {
		@traced()
		async getRun(req: GetRunRequest): Promise<GetRunResponse> {
			const db = this.deps.db
			const row = await withQueryName("runs.get", () =>
				db.query.run_history.findFirst({
					where: eq(run_history.id, req.id),
				}),
			)
			if (!row) {
				throw new AppError({
					message: `run not found: ${req.id}`,
					publicMessage: "Run not found.",
					status: 404,
					fields: { run_id: req.id },
				})
			}
			return to_run_dto(row)
		}
	}
}
