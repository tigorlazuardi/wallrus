import type { PageLoad } from "./$types"
import type { Device } from "$lib/schemas/devices/Device"

export interface DevicesPageData {
	items: Device[]
	total: number
	error?: string
}

export const load: PageLoad = async ({ fetch }): Promise<DevicesPageData> => {
	const res = await fetch("/api/v1/devices?limit=200")
	if (!res.ok) {
		return {
			items: [],
			total: 0,
			error: `Failed to load devices (${res.status})`,
		}
	}
	const data = await res.json()
	return {
		items: data.items ?? [],
		total: data.total ?? 0,
	}
}
