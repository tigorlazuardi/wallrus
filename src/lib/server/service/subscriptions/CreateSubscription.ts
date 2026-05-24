import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { Cron } from "croner"
import { uuidv7 } from "uuidv7"
import type {
	CreateSubscriptionRequest,
	CreateSubscriptionResponse,
} from "$lib/schemas/subscriptions/CreateSubscription"
import { subscriptions } from "$lib/server/db/schema"
import { get_source } from "$lib/server/sources/_registry"
import { runtime_ref } from "$lib/server/runtime"
import { reload } from "$lib/server/scheduler/cron"
import { type Constructor, to_subscription_dto } from "./base"

export function CreateSubscription<T extends Constructor>(Sup: T) {
	return class CreateSubscription extends Sup {
		@traced()
		async createSubscription(
			req: CreateSubscriptionRequest,
		): Promise<CreateSubscriptionResponse> {
			const db = this.deps.db

			// Validate cron expression via croner
			try {
				new Cron(req.cron, { paused: true })
			} catch (err) {
				throw AppError.fail("validation.cron_invalid", {
					status: 400,
					publicMessage: `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`,
					fields: { cron: req.cron },
				})
			}

			// Validate source slug and per-source input_params
			const src = get_source(req.source_slug)
			if (!src) {
				throw AppError.fail("validation.unknown_source", {
					status: 400,
					publicMessage: `Unknown source slug: ${req.source_slug}`,
					fields: { source_slug: req.source_slug },
				})
			}

			const params_parsed = src.params_schema.safeParse(req.input_params)
			if (!params_parsed.success) {
				throw AppError.fail("validation.input_params", {
					status: 400,
					publicMessage: "Invalid input_params for this source.",
					fields: params_parsed.error.flatten().fieldErrors as Record<string, unknown>,
				})
			}

			const now = Date.now()
			const id = uuidv7()

			const rows = await withQueryName("subscriptions.create", () =>
				db
					.insert(subscriptions)
					.values({
						id,
						source_slug: req.source_slug,
						name: req.name,
						input_params: req.input_params,
						cron: req.cron,
						enabled: true,
						max_items_inspected: req.max_items_inspected ?? null,
						created_at: now,
					})
					.returning(),
			)

			const row = rows[0]
			if (!row) {
				throw AppError.fail("internal.insert_failed", {
					status: 500,
					publicMessage: "Failed to create subscription.",
				})
			}

			await reload(runtime_ref())

			return to_subscription_dto(row)
		}
	}
}
