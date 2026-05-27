/**
 * useSubscriptionMutation — composable mutation hook for subscription operations.
 *
 * Returns action functions with no internal state. Each function calls the
 * API and returns the parsed response. Callers are responsible for any
 * reactive state (e.g. calling hook.refetch() or invalidateAll() after
 * a mutation succeeds).
 *
 * Endpoints:
 *   POST   /api/v1/subscriptions                              → create (201)
 *   PATCH  /api/v1/subscriptions/[id]                        → update (200)
 *   DELETE /api/v1/subscriptions/[id]                        → delete (204, no body)
 *   POST   /api/v1/subscriptions/[id]/toggle                 → toggle (200)
 *   POST   /api/v1/subscriptions/[id]/devices                → linkDevice (201)
 *   DELETE /api/v1/subscriptions/[id]/devices/[device_id]    → unlinkDevice (204, no body)
 */

import { apiFetch } from "$lib/client/fetcher"
import {
	CreateSubscriptionRequestSchema,
	CreateSubscriptionResponseSchema,
	type CreateSubscriptionRequest,
	type CreateSubscriptionResponse,
} from "$lib/schemas/subscriptions/CreateSubscription"
import {
	UpdateSubscriptionRequestSchema,
	UpdateSubscriptionResponseSchema,
	type UpdateSubscriptionRequest,
	type UpdateSubscriptionResponse,
} from "$lib/schemas/subscriptions/UpdateSubscription"
import {
	ToggleSubscriptionResponseSchema,
	type ToggleSubscriptionRequest,
	type ToggleSubscriptionResponse,
} from "$lib/schemas/subscriptions/ToggleSubscription"
import {
	LinkDeviceResponseSchema,
	type LinkDeviceResponse,
} from "$lib/schemas/subscriptions/LinkDevice"

export function useSubscriptionMutation() {
	/**
	 * Create a new subscription.
	 * POST /api/v1/subscriptions → 201 with created subscription body.
	 */
	async function create(input: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
		// Parse input through Zod to apply any transforms.
		const body = CreateSubscriptionRequestSchema.parse(input)
		const res = await apiFetch("/api/v1/subscriptions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return CreateSubscriptionResponseSchema.parse(await res.json())
	}

	/**
	 * Update an existing subscription.
	 * PATCH /api/v1/subscriptions/[id] → 200 with updated subscription body.
	 * The id is taken from input.id; the path param uses the UUID.
	 */
	async function update(input: UpdateSubscriptionRequest): Promise<UpdateSubscriptionResponse> {
		const body = UpdateSubscriptionRequestSchema.parse(input)
		const res = await apiFetch(`/api/v1/subscriptions/${encodeURIComponent(body.id)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return UpdateSubscriptionResponseSchema.parse(await res.json())
	}

	/**
	 * Delete a subscription (soft-delete).
	 * DELETE /api/v1/subscriptions/[id] → 204 no body.
	 */
	async function deleteSubscription(id: string): Promise<void> {
		const res = await apiFetch(`/api/v1/subscriptions/${encodeURIComponent(id)}`, {
			method: "DELETE",
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	/**
	 * Toggle a subscription's enabled state.
	 * POST /api/v1/subscriptions/[id]/toggle → 200 with updated subscription body.
	 */
	async function toggle(input: ToggleSubscriptionRequest): Promise<ToggleSubscriptionResponse> {
		const res = await apiFetch(`/api/v1/subscriptions/${encodeURIComponent(input.id)}/toggle`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: input.enabled }),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return ToggleSubscriptionResponseSchema.parse(await res.json())
	}

	/**
	 * Link a device to a subscription.
	 * POST /api/v1/subscriptions/[id]/devices → 201 with link body.
	 */
	async function linkDevice(
		subscription_id: string,
		device_id: string,
	): Promise<LinkDeviceResponse> {
		const res = await apiFetch(
			`/api/v1/subscriptions/${encodeURIComponent(subscription_id)}/devices`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_id }),
			},
		)
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return LinkDeviceResponseSchema.parse(await res.json())
	}

	/**
	 * Unlink a device from a subscription.
	 * DELETE /api/v1/subscriptions/[id]/devices/[device_id] → 204 no body.
	 */
	async function unlinkDevice(subscription_id: string, device_id: string): Promise<void> {
		const res = await apiFetch(
			`/api/v1/subscriptions/${encodeURIComponent(subscription_id)}/devices/${encodeURIComponent(device_id)}`,
			{
				method: "DELETE",
			},
		)
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	return { create, update, delete: deleteSubscription, toggle, linkDevice, unlinkDevice }
}
