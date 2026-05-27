import type { PageLoad } from "./$types"
import { error } from "@sveltejs/kit"
import { superValidate } from "sveltekit-superforms"
import { zod4 as zod } from "sveltekit-superforms/adapters"
import { GetDeviceResponseSchema } from "$lib/schemas/devices/GetDevice"
import { UpdateDeviceRequestSchema } from "$lib/schemas/devices/UpdateDevice"

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/v1/devices/${encodeURIComponent(params.slug)}`)
	if (!res.ok) {
		if (res.status === 404) {
			error(404, `Device "${params.slug}" not found.`)
		}
		error(res.status, `Failed to load device (${res.status})`)
	}

	const device = GetDeviceResponseSchema.parse(await res.json())

	const form = await superValidate(
		{ id: device.id, name: device.name, filter_criteria: device.filter_criteria },
		zod(UpdateDeviceRequestSchema),
	)
	return { form, device }
}
