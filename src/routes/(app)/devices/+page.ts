import type { PageLoad } from "./$types"
import type { Device } from "$lib/schemas/devices/Device"
import type { ListDevicesResponse } from "$lib/schemas/devices/ListDevices"
import { ListDevicesResponseSchema } from "$lib/schemas/devices/ListDevices"

export interface DevicesPageData {
	devices: ListDevicesResponse | null
	error?: string
}

export const load: PageLoad = async ({ fetch }): Promise<DevicesPageData> => {
	const res = await fetch("/api/v1/devices?limit=200")
	if (!res.ok) {
		return {
			devices: { items: [] as Device[], total: 0 },
			error: `Failed to load devices (${res.status})`,
		}
	}
	const devices = ListDevicesResponseSchema.parse(await res.json())
	return { devices }
}
