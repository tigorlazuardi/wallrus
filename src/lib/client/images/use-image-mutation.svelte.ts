/**
 * useImageMutation — composable mutation hook for image operations.
 *
 * Returns action functions with no internal state. Each function calls the
 * API and returns the parsed response (or void for 204 responses). Callers
 * are responsible for any reactive state updates (e.g. calling reset() or
 * invalidateAll() after a mutation succeeds).
 *
 * Endpoints:
 *   POST   /api/v1/images/[id]/favorite        → toggleFavorite (200 Image)
 *   DELETE /api/v1/images/[id]?blacklist=false  → softDelete (204, void)
 *   DELETE /api/v1/images/[id]?blacklist=true   → blacklist (204, void)
 *   POST   /api/v1/images/[id]/restore          → restore (200 Image)
 *   POST   /api/v1/images/[id]/tags             → addTag (200 AddTagResponse)
 *   DELETE /api/v1/images/[id]/tags/[tag]       → removeTag (204, void)
 */

import { apiFetch } from "$lib/client/fetcher"
import {
	ToggleFavoriteResponseSchema,
	type ToggleFavoriteResponse,
} from "$lib/schemas/images/ToggleFavorite"
import {
	RestoreImageResponseSchema,
	type RestoreImageResponse,
} from "$lib/schemas/images/RestoreImage"
import { AddTagResponseSchema, type AddTagResponse } from "$lib/schemas/images/AddTag"

export function useImageMutation() {
	/**
	 * Toggle favorite state for an image.
	 * POST /api/v1/images/[id]/favorite  { favorited: boolean } → 200 Image
	 */
	async function toggleFavorite(id: string, favorited: boolean): Promise<ToggleFavoriteResponse> {
		const res = await apiFetch(`/api/v1/images/${encodeURIComponent(id)}/favorite`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ favorited }),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return ToggleFavoriteResponseSchema.parse(await res.json())
	}

	/**
	 * Soft-delete an image (recoverable via restore).
	 * DELETE /api/v1/images/[id]?blacklist=false → 204 no body
	 */
	async function softDelete(id: string): Promise<void> {
		const res = await apiFetch(`/api/v1/images/${encodeURIComponent(id)}?blacklist=false`, {
			method: "DELETE",
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	/**
	 * Blacklist an image (permanent — skipped on future crawls).
	 * DELETE /api/v1/images/[id]?blacklist=true → 204 no body
	 */
	async function blacklist(id: string): Promise<void> {
		const res = await apiFetch(`/api/v1/images/${encodeURIComponent(id)}?blacklist=true`, {
			method: "DELETE",
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	/**
	 * Restore a soft-deleted image.
	 * POST /api/v1/images/[id]/restore → 200 Image
	 */
	async function restore(id: string): Promise<RestoreImageResponse> {
		const res = await apiFetch(`/api/v1/images/${encodeURIComponent(id)}/restore`, {
			method: "POST",
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return RestoreImageResponseSchema.parse(await res.json())
	}

	/**
	 * Add a user tag to an image. Idempotent.
	 * POST /api/v1/images/[id]/tags  { tag: string } → 200 { image_id, tag, created_at }
	 */
	async function addTag(id: string, tag: string): Promise<AddTagResponse> {
		const res = await apiFetch(`/api/v1/images/${encodeURIComponent(id)}/tags`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ tag }),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return AddTagResponseSchema.parse(await res.json())
	}

	/**
	 * Remove a user tag from an image.
	 * DELETE /api/v1/images/[id]/tags/[tag] → 204 no body
	 */
	async function removeTag(id: string, tag: string): Promise<void> {
		const res = await apiFetch(
			`/api/v1/images/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}`,
			{ method: "DELETE" },
		)
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	return { toggleFavorite, softDelete, blacklist, restore, addTag, removeTag }
}
