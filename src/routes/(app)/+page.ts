import type { PageLoad } from "./$types"
import { ListImagesResponseSchema, type ListImagesResponse } from "$lib/schemas/images/ListImages"
import { ListDevicesResponseSchema } from "$lib/schemas/devices/ListDevices"
import type { Device } from "$lib/schemas/devices/Device"

export interface GalleryData {
	images: ListImagesResponse | null
	devices: Device[]
	error?: string
}

export const load: PageLoad = async ({ fetch, url }): Promise<GalleryData> => {
	const params = new URLSearchParams()

	const device = url.searchParams.get("device")
	const source = url.searchParams.get("source")
	const favorited = url.searchParams.get("favorited")
	const nsfw = url.searchParams.get("nsfw")

	if (device) params.set("device_id", device)
	if (source) params.set("source_slug", source)
	if (favorited) params.set("favorited", favorited)
	if (nsfw) params.set("nsfw", nsfw)
	params.set("limit", "50")

	const [img_res, dev_res] = await Promise.all([
		fetch(`/api/v1/images?${params.toString()}`),
		fetch(`/api/v1/devices?limit=100`),
	])

	if (!img_res.ok) {
		return {
			images: null,
			devices: [],
			error: `Failed to load images (${img_res.status})`,
		}
	}

	const images = ListImagesResponseSchema.parse(await img_res.json())
	const devices: Device[] = dev_res.ok
		? ListDevicesResponseSchema.parse(await dev_res.json()).items
		: []

	return { images, devices }
}
