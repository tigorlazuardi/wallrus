/**
 * useSubscription — composable single-subscription hook.
 *
 * Fetches subscription data by UUID from GET /api/v1/subscriptions/[id].
 * Accepts optional `initial` data (from a universal load or SSR prefill);
 * when provided the first fetch is skipped.
 *
 * Uses apiFetch() so the base URL resolves correctly in both web (relative,
 * same-origin) and mobile (absolute, injected via set_api_base in slice 016).
 */

import { apiFetch } from "$lib/client/fetcher"
import {
	GetSubscriptionResponseSchema,
	type GetSubscriptionResponse,
} from "$lib/schemas/subscriptions/GetSubscription"

export function useSubscription(id: string, initial?: GetSubscriptionResponse) {
	const state = $state<{
		data: GetSubscriptionResponse | null
		loading: boolean
		error: Error | null
	}>({
		data: initial ?? null,
		loading: !initial,
		error: null,
	})

	async function refetch(): Promise<void> {
		state.loading = true
		try {
			const res = await apiFetch(`/api/v1/subscriptions/${encodeURIComponent(id)}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			state.data = GetSubscriptionResponseSchema.parse(await res.json())
			state.error = null
		} catch (e) {
			state.error = e as Error
		} finally {
			state.loading = false
		}
	}

	if (!initial) refetch()

	return { state, refetch }
}
