import { join } from "node:path"

// On-disk path scheme — sync-friendly for syncthing/rsync.
// See `.claude/rules/scope.md` §Storage and path scheme.

export function thumbnails_dir(base_dir: string) {
	return join(base_dir, ".thumbs")
}

export function staging_dir(base_dir: string) {
	return join(base_dir, ".staging")
}

export function device_dir(base_dir: string, device_slug: string) {
	return join(base_dir, device_slug)
}

export function thumbnail_path(base_dir: string, image_id: string) {
	return join(thumbnails_dir(base_dir), `${image_id}.webp`)
}

export function device_image_path(
	base_dir: string,
	device_slug: string,
	source_slug: string,
	filename: string,
	ext: string,
) {
	return join(device_dir(base_dir, device_slug), `${source_slug}-${filename}.${ext}`)
}
