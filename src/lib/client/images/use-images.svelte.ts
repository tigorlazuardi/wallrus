/**
 * useImages — composable gallery list hook with cursor pagination state.
 *
 * Accepts optional `initial` data (from a universal load or SSR prefill).
 * When `initial` is provided the first fetch is skipped. Call `reset(data)`
 * when filters change (SvelteKit navigation re-runs load(); the gallery
 * calls reset() to replace items and cursor).
 *
 * Call `loadMore()` to fetch the next page using the current filter query
 * string + `next_cursor`. Items are appended; cursor advances.
 *
 * The `filters` parameter is a getter function (or URLSearchParams object)
 * that returns the current filter query string. This lets the gallery read
 * filters from `$page.url.searchParams` reactively without coupling the
 * hook to the Svelte stores directly.
 *
 * Uses apiFetch() so the base URL resolves correctly in both web (relative,
 * same-origin) and mobile (absolute, injected via set_api_base in slice 016).
 */

import { apiFetch } from "$lib/client/fetcher"
import { ListImagesResponseSchema, type ListImagesResponse } from "$lib/schemas/images/ListImages"
import type { Image } from "$lib/schemas/images/Image"

export interface UseImagesState {
	items: Image[]
	total: number
	next_cursor: string | undefined
	loading: boolean
	error: Error | null
}

/**
 * useImages
 *
 * @param initial - Optional prefetched response from a universal load.
 * @param filters - A getter returning the current filter query string
 *                  (without leading "?"). Included verbatim in every request.
 *                  Omit or return "" for no filters.
 */
export function useImages(initial?: ListImagesResponse, filters: () => string = () => "") {
	const state = $state<UseImagesState>({
		items: initial ? [...initial.items] : [],
		total: initial?.total ?? 0,
		next_cursor: initial?.next_cursor,
		loading: false,
		error: null,
	})

	/**
	 * Build the query string for a page fetch.
	 * Appends `next=<cursor>&limit=50` to the current filter params.
	 */
	function build_query(cursor?: string): string {
		const base = filters()
		const parts: string[] = []
		if (base) parts.push(base)
		if (cursor) parts.push(`next=${encodeURIComponent(cursor)}`)
		parts.push("limit=50")
		return parts.join("&")
	}

	/**
	 * Fetch the next page and append items. No-op if no cursor or already loading.
	 */
	async function loadMore(): Promise<void> {
		if (state.loading || !state.next_cursor) return
		state.loading = true
		try {
			const query = build_query(state.next_cursor)
			const res = await apiFetch(`/api/v1/images?${query}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = ListImagesResponseSchema.parse(await res.json())
			state.items = [...state.items, ...data.items]
			state.next_cursor = data.next_cursor
			state.total = data.total
			state.error = null
		} catch (e) {
			state.error = e as Error
		} finally {
			state.loading = false
		}
	}

	/**
	 * Replace items/cursor/total with fresh data (call when filters change).
	 * Mirrors the gallery's current `$effect(() => { items = [...data.items]; ... })`.
	 */
	function reset(data: ListImagesResponse): void {
		state.items = [...data.items]
		state.total = data.total
		state.next_cursor = data.next_cursor
		state.error = null
	}

	return { state, loadMore, reset }
}
