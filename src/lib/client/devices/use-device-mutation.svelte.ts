/**
 * useDeviceMutation — composable mutation hook for device operations.
 *
 * Returns action functions with no internal state. Each function calls the
 * API and returns the parsed response. Callers are responsible for any
 * reactive state (e.g. calling hook.refetch() or invalidateAll() after
 * a mutation succeeds).
 *
 * Endpoints:
 *   POST   /api/v1/devices                  → create (201)
 *   PATCH  /api/v1/devices/[slug]            → update (200)
 *   DELETE /api/v1/devices/[slug]            → delete (204, no body)
 *   POST   /api/v1/devices/[slug]/toggle     → toggle (200)
 */

import { apiFetch } from "$lib/client/fetcher"
import {
	CreateDeviceRequestSchema,
	CreateDeviceResponseSchema,
	type CreateDeviceRequest,
	type CreateDeviceResponse,
} from "$lib/schemas/devices/CreateDevice"
import {
	UpdateDeviceRequestSchema,
	UpdateDeviceResponseSchema,
	type UpdateDeviceRequest,
	type UpdateDeviceResponse,
} from "$lib/schemas/devices/UpdateDevice"
import {
	type ToggleDeviceRequest,
	ToggleDeviceResponseSchema,
} from "$lib/schemas/devices/ToggleDevice"
import type { ToggleDeviceResponse } from "$lib/schemas/devices/ToggleDevice"

export function useDeviceMutation() {
	/**
	 * Create a new device.
	 * POST /api/v1/devices → 201 with created device body.
	 */
	async function create(input: CreateDeviceRequest): Promise<CreateDeviceResponse> {
		// Parse input through Zod to apply transforms (e.g. slug toLowerCase).
		const body = CreateDeviceRequestSchema.parse(input)
		const res = await apiFetch("/api/v1/devices", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return CreateDeviceResponseSchema.parse(await res.json())
	}

	/**
	 * Update an existing device.
	 * PATCH /api/v1/devices/[id] → 200 with updated device body.
	 * The id is taken from input.id; the path param uses the UUID.
	 */
	async function update(input: UpdateDeviceRequest): Promise<UpdateDeviceResponse> {
		const body = UpdateDeviceRequestSchema.parse(input)
		// The PATCH endpoint resolves slug-or-id from the path; send the UUID.
		const res = await apiFetch(`/api/v1/devices/${encodeURIComponent(body.id)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return UpdateDeviceResponseSchema.parse(await res.json())
	}

	/**
	 * Delete a device.
	 * DELETE /api/v1/devices/[slug] → 204 no body.
	 */
	async function deleteDevice(id: string): Promise<void> {
		const res = await apiFetch(`/api/v1/devices/${encodeURIComponent(id)}`, {
			method: "DELETE",
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		// 204 — no body to parse.
	}

	/**
	 * Toggle a device's enabled state.
	 * POST /api/v1/devices/[slug]/toggle → 200 with updated device body.
	 */
	async function toggle(input: ToggleDeviceRequest): Promise<ToggleDeviceResponse> {
		const res = await apiFetch(`/api/v1/devices/${encodeURIComponent(input.id)}/toggle`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: input.enabled }),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}
		return ToggleDeviceResponseSchema.parse(await res.json())
	}

	return { create, update, delete: deleteDevice, toggle }
}
