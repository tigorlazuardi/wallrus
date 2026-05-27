/**
 * useDevices — composable list hook for device data.
 *
 * Accepts optional `initial` data (from a universal load or SSR prefill).
 * When `initial` is provided the first fetch is skipped; call `refetch()`
 * to reload from the API.
 *
 * Uses apiFetch() so the base URL resolves correctly in both web (relative,
 * same-origin) and mobile (absolute, injected via set_api_base in slice 016).
 */

import { apiFetch } from "$lib/client/fetcher"
import {
	ListDevicesResponseSchema,
	type ListDevicesResponse,
} from "$lib/schemas/devices/ListDevices"

export function useDevices(initial?: ListDevicesResponse) {
	const state = $state<{
		data: ListDevicesResponse | null
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
			const res = await apiFetch("/api/v1/devices")
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			state.data = ListDevicesResponseSchema.parse(await res.json())
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
