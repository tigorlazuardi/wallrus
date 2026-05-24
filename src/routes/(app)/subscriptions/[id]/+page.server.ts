import { fail, redirect, error } from "@sveltejs/kit"
import type { Actions, PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import { list_sources, get_source } from "$lib/server/sources/_registry"
import { serialize_params_schema } from "$lib/server/sources/params_descriptor"
import { UpdateSubscriptionRequestSchema } from "$lib/schemas/subscriptions/UpdateSubscription"
import { LinkDeviceRequestSchema } from "$lib/schemas/subscriptions/LinkDevice"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

export const load: PageServerLoad = async ({ params }) => {
	let subscription
	try {
		subscription = await runtime_ref().services.subscriptions.getSubscription({ id: params.id })
	} catch (err) {
		const app_err = AppError.is(err, AppError)
		if (app_err && app_err.status === 404) {
			error(404, `Subscription "${params.id}" not found.`)
		}
		throw err
	}

	// Load linked devices
	const linked_result = await runtime_ref().services.subscriptions.listSubscriptionDevices({
		subscription_id: subscription.id,
		limit: 200,
		offset: 0,
	})

	// Load all devices for the device selector
	const all_devices_result = await runtime_ref().services.devices.listDevices({
		limit: 200,
		offset: 0,
	})

	// Serialize param descriptors for the subscription's source
	const source_modules = list_sources()
	const sources = source_modules.map((m) => ({
		slug: m.slug,
		display_name: m.display_name,
		param_descriptors: serialize_params_schema(m.params_schema),
	}))

	// Get param descriptors for this subscription's source
	const source_module = get_source(subscription.source_slug)
	const param_descriptors = source_module
		? serialize_params_schema(source_module.params_schema)
		: []

	return {
		subscription,
		linked_device_ids: linked_result.items.map((d) => d.id),
		devices: all_devices_result.items.map((d) => ({ id: d.id, slug: d.slug, name: d.name })),
		sources,
		param_descriptors,
	}
}

export const actions: Actions = {
	update: async ({ request, params }) => {
		let body: unknown
		try {
			body = await request.json()
		} catch {
			return fail(400, { error: "Invalid JSON body." })
		}

		const { name, input_params, cron, max_items_inspected, linked_device_ids } = (body ??
			{}) as Record<string, unknown>

		const parsed = UpdateSubscriptionRequestSchema.safeParse({
			id: params.id,
			name,
			input_params,
			cron,
			max_items_inspected: max_items_inspected ?? undefined,
		})

		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: body,
			})
		}

		// Validate source params if provided
		const subscription = await runtime_ref().services.subscriptions.getSubscription({
			id: params.id,
		})
		const source = get_source(subscription.source_slug)
		if (source && parsed.data.input_params) {
			const params_result = source.params_schema.safeParse(parsed.data.input_params)
			if (!params_result.success) {
				return fail(400, {
					errors: { input_params: params_result.error.flatten().fieldErrors },
					values: body,
				})
			}
		}

		await runtime_ref().services.subscriptions.updateSubscription(parsed.data)

		// Reconcile device links
		if (Array.isArray(linked_device_ids)) {
			const current_linked =
				await runtime_ref().services.subscriptions.listSubscriptionDevices({
					subscription_id: params.id,
					limit: 200,
					offset: 0,
				})
			const current_ids = new Set(current_linked.items.map((d) => d.id))
			const new_ids = new Set(linked_device_ids as string[])

			// Link newly added
			for (const device_id of new_ids) {
				if (!current_ids.has(device_id)) {
					const link_parsed = LinkDeviceRequestSchema.safeParse({
						subscription_id: params.id,
						device_id,
					})
					if (link_parsed.success) {
						await runtime_ref().services.subscriptions.linkDevice(link_parsed.data)
					}
				}
			}

			// Unlink removed
			for (const device_id of current_ids) {
				if (!new_ids.has(device_id)) {
					await runtime_ref().services.subscriptions.unlinkDevice({
						subscription_id: params.id,
						device_id,
					})
				}
			}
		}

		redirect(303, `/subscriptions/${params.id}`)
	},

	toggle: async ({ params }) => {
		const sub = await runtime_ref().services.subscriptions.getSubscription({ id: params.id })
		await runtime_ref().services.subscriptions.toggleSubscription({
			id: params.id,
			enabled: !sub.enabled,
		})
		redirect(303, `/subscriptions/${params.id}`)
	},

	delete: async ({ params }) => {
		await runtime_ref().services.subscriptions.deleteSubscription({ id: params.id })
		redirect(303, "/subscriptions")
	},
}
