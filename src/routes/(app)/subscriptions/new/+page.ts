import type { PageLoad } from "./$types"
import { ListSourcesResponseSchema } from "$lib/schemas/sources/ListSources"
import { ListDevicesResponseSchema } from "$lib/schemas/devices/ListDevices"

export const load: PageLoad = async ({ fetch }) => {
	const [sources_res, devices_res] = await Promise.all([
		fetch("/api/v1/sources"),
		fetch("/api/v1/devices?limit=200"),
	])

	const sources_data = ListSourcesResponseSchema.parse(await sources_res.json())
	const devices_data = ListDevicesResponseSchema.parse(await devices_res.json())

	return {
		sources: sources_data.items,
		devices: devices_data.items.map((d) => ({ id: d.id, slug: d.slug, name: d.name })),
	}
}
