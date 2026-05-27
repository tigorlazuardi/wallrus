import { error } from "@sveltejs/kit"
import type { PageLoad } from "./$types"
import { GetSubscriptionResponseSchema } from "$lib/schemas/subscriptions/GetSubscription"
import { ListSubscriptionDevicesResponseSchema } from "$lib/schemas/subscriptions/ListSubscriptionDevices"
import { ListDevicesResponseSchema } from "$lib/schemas/devices/ListDevices"
import { ListSourcesResponseSchema } from "$lib/schemas/sources/ListSources"

export const load: PageLoad = async ({ fetch, params }) => {
	// Fetch subscription first (need source_slug to derive param_descriptors)
	const sub_res = await fetch(`/api/v1/subscriptions/${params.id}`)
	if (!sub_res.ok) {
		if (sub_res.status === 404) {
			error(404, `Subscription "${params.id}" not found.`)
		}
		error(sub_res.status, `Failed to load subscription (${sub_res.status})`)
	}
	const subscription = GetSubscriptionResponseSchema.parse(await sub_res.json())

	// Fetch linked devices, all devices, and sources in parallel
	const [linked_res, devices_res, sources_res] = await Promise.all([
		fetch(`/api/v1/subscriptions/${params.id}/devices?limit=200`),
		fetch(`/api/v1/devices?limit=200`),
		fetch(`/api/v1/sources`),
	])

	const linked_data = linked_res.ok
		? ListSubscriptionDevicesResponseSchema.parse(await linked_res.json())
		: { items: [], total: 0 }

	const devices_data = devices_res.ok
		? ListDevicesResponseSchema.parse(await devices_res.json())
		: { items: [], total: 0 }

	const sources_data = sources_res.ok
		? ListSourcesResponseSchema.parse(await sources_res.json())
		: { items: [] }

	const param_descriptors =
		sources_data.items.find((s) => s.slug === subscription.source_slug)?.param_descriptors ?? []

	return {
		subscription,
		linked_device_ids: linked_data.items.map((d) => d.id),
		devices: devices_data.items.map((d) => ({ id: d.id, slug: d.slug, name: d.name })),
		sources: sources_data.items,
		param_descriptors,
	}
}
