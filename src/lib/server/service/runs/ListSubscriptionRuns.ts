import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import type {
	ListSubscriptionRunsRequest,
	ListSubscriptionRunsResponse,
} from "$lib/schemas/runs/ListSubscriptionRuns"
import { type Constructor } from "./base"

/**
 * ListSubscriptionRuns mixin.
 *
 * Delegates to `listRuns` (provided by the ListRuns mixin in the chain)
 * with `subscription_id` pinned. Must be composed AFTER ListRuns in the
 * mixin chain so that `this.listRuns` is available.
 */
export function ListSubscriptionRuns<T extends Constructor>(Sup: T) {
	return class ListSubscriptionRuns extends Sup {
		@traced()
		async listSubscriptionRuns(
			req: ListSubscriptionRunsRequest,
		): Promise<ListSubscriptionRunsResponse> {
			// listRuns is provided by the ListRuns mixin, which must appear
			// earlier (outer) in the composition chain.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (this as any).listRuns({
				...req,
				subscription_id: req.subscription_id,
			})
		}
	}
}
