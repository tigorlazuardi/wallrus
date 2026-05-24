import type { PageLoad } from "./$types"
import type { Device } from "$lib/schemas/devices/Device"
import type { Image } from "$lib/schemas/images/Image"

export interface DeviceDetailData {
	device: Device | null
	images: Image[]
	images_total: number
	images_next_cursor?: string
	error?: string
}

export const load: PageLoad = async ({ fetch, params }): Promise<DeviceDetailData> => {
	const [dev_res, img_res] = await Promise.all([
		fetch(`/api/v1/devices/${params.slug}`),
		fetch(`/api/v1/devices/${params.slug}/images?limit=24`),
	])

	if (!dev_res.ok) {
		return {
			device: null,
			images: [],
			images_total: 0,
			error:
				dev_res.status === 404
					? `Device "${params.slug}" not found.`
					: `Failed to load device (${dev_res.status})`,
		}
	}

	const device: Device = await dev_res.json()
	let images: Image[] = []
	let images_total = 0
	let images_next_cursor: string | undefined

	if (img_res.ok) {
		const img_data = await img_res.json()
		images = img_data.items ?? []
		images_total = img_data.total ?? 0
		images_next_cursor = img_data.next_cursor
	}

	return { device, images, images_total, images_next_cursor }
}
