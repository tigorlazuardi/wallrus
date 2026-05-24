import { fail, redirect } from "@sveltejs/kit"
import { superValidate } from "sveltekit-superforms"
import { zod4 as zod } from "sveltekit-superforms/adapters"
import type { Actions, PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import {
	CreateDeviceRequestSchema,
	type CreateDeviceRequest,
} from "$lib/schemas/devices/CreateDevice"

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod(CreateDeviceRequestSchema))
	return { form }
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(CreateDeviceRequestSchema))

		if (!form.valid) {
			return fail(400, { form })
		}

		const device = await runtime_ref().services.devices.createDevice(
			form.data as unknown as CreateDeviceRequest,
		)

		redirect(303, `/devices/${device.slug}`)
	},
}
