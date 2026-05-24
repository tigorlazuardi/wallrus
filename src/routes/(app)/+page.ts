import type { PageLoad } from "./$types"
import type { Image } from "$lib/schemas/images/Image"

export interface Device {
	id: string
	slug: string
	name: string
}

export interface GalleryData {
	items: Image[]
	total: number
	next_cursor: string | undefined
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
			items: [],
			total: 0,
			next_cursor: undefined,
			devices: [],
			error: `Failed to load images (${img_res.status})`,
		}
	}

	const data = await img_res.json()
	const devices: Device[] = dev_res.ok ? (await dev_res.json()).items : []

	return {
		items: data.items ?? [],
		total: data.total ?? 0,
		next_cursor: data.next_cursor,
		devices,
	}
}
