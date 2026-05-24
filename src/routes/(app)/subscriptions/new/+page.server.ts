import { fail, redirect } from "@sveltejs/kit"
import type { Actions, PageServerLoad } from "./$types"
import { runtime_ref } from "$lib/server/runtime"
import { list_sources, get_source } from "$lib/server/sources/_registry"
import { serialize_params_schema } from "$lib/server/sources/params_descriptor"
import { CreateSubscriptionRequestSchema } from "$lib/schemas/subscriptions/CreateSubscription"
import { LinkDeviceRequestSchema } from "$lib/schemas/subscriptions/LinkDevice"

export const load: PageServerLoad = async () => {
	const source_modules = list_sources()

	// Serialize param descriptors for every source so the client can switch
	// source selection without another round trip.
	const sources = source_modules.map((m) => ({
		slug: m.slug,
		display_name: m.display_name,
		param_descriptors: serialize_params_schema(m.params_schema),
	}))

	const devices_result = await runtime_ref().services.devices.listDevices({
		limit: 200,
		offset: 0,
	})

	return {
		sources,
		devices: devices_result.items.map((d) => ({ id: d.id, slug: d.slug, name: d.name })),
	}
}

export const actions: Actions = {
	default: async ({ request }) => {
		let body: unknown
		try {
			body = await request.json()
		} catch {
			return fail(400, { error: "Invalid JSON body." })
		}

		const {
			source_slug,
			name,
			input_params,
			cron,
			max_items_inspected,
			linked_device_ids = [],
		} = (body ?? {}) as Record<string, unknown>

		const parsed = CreateSubscriptionRequestSchema.safeParse({
			source_slug,
			name,
			input_params: input_params ?? {},
			cron,
			max_items_inspected: max_items_inspected ?? undefined,
		})

		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: { source_slug, name, input_params, cron, max_items_inspected },
			})
		}

		// Validate source params against its schema
		const source = get_source(parsed.data.source_slug)
		if (source) {
			const params_result = source.params_schema.safeParse(parsed.data.input_params)
			if (!params_result.success) {
				return fail(400, {
					errors: { input_params: params_result.error.flatten().fieldErrors },
					values: { source_slug, name, input_params, cron, max_items_inspected },
				})
			}
		}

		const subscription = await runtime_ref().services.subscriptions.createSubscription(
			parsed.data,
		)

		// Link devices
		const device_ids = Array.isArray(linked_device_ids) ? linked_device_ids : []
		for (const device_id of device_ids) {
			const link_parsed = LinkDeviceRequestSchema.safeParse({
				subscription_id: subscription.id,
				device_id,
			})
			if (link_parsed.success) {
				await runtime_ref().services.subscriptions.linkDevice(link_parsed.data)
			}
		}

		redirect(303, `/subscriptions/${subscription.id}`)
	},
}
