import { fail, redirect, error } from "@sveltejs/kit"
import { superValidate } from "sveltekit-superforms"
import { zod4 as zod } from "sveltekit-superforms/adapters"
import type { Actions, PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import {
	UpdateDeviceRequestSchema,
	type UpdateDeviceRequest,
} from "$lib/schemas/devices/UpdateDevice"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

export const load: PageServerLoad = async ({ params }) => {
	let device
	try {
		device = await runtime_ref().services.devices.getDevice({ slug: params.slug })
	} catch (err) {
		const app_err = AppError.is(err, AppError)
		if (app_err && app_err.status === 404) {
			error(404, `Device "${params.slug}" not found.`)
		}
		throw err
	}

	const form = await superValidate(
		{ id: device.id, name: device.name, filter_criteria: device.filter_criteria },
		zod(UpdateDeviceRequestSchema),
	)
	return { form, device }
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(UpdateDeviceRequestSchema))

		if (!form.valid) {
			return fail(400, { form })
		}

		const device = await runtime_ref().services.devices.updateDevice(
			form.data as unknown as UpdateDeviceRequest,
		)

		redirect(303, `/devices/${device.slug}`)
	},
}
