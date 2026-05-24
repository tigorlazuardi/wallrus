/**
 * Seed helper for image-domain tests.
 *
 * Inserts 20 image rows across 2 devices, 2 sources, with mixed
 * nsfw/favorited/tagged states. All IDs are literal stable strings so
 * tests can assert specific rows.
 */
import type { DbClient } from "$lib/server/db/client"
import { images, devices, device_images, favorites, image_user_tags } from "$lib/server/db/schema"

// Device IDs
export const DEVICE_A = "01900000-deva-7000-8000-000000000001"
export const DEVICE_B = "01900000-devb-7000-8000-000000000002"

// Image IDs (20 total)
export const IMG = {
	// device A, source "reddit", sfw
	i01: "01900001-0001-7000-8000-000000000001",
	i02: "01900001-0002-7000-8000-000000000002",
	i03: "01900001-0003-7000-8000-000000000003",
	i04: "01900001-0004-7000-8000-000000000004",
	i05: "01900001-0005-7000-8000-000000000005",
	// device A, source "reddit", nsfw
	i06: "01900001-0006-7000-8000-000000000006",
	i07: "01900001-0007-7000-8000-000000000007",
	// device A, source "booru", sfw
	i08: "01900001-0008-7000-8000-000000000008",
	i09: "01900001-0009-7000-8000-000000000009",
	i10: "01900001-0010-7000-8000-000000000010",
	// device B, source "reddit", sfw
	i11: "01900001-0011-7000-8000-000000000011",
	i12: "01900001-0012-7000-8000-000000000012",
	i13: "01900001-0013-7000-8000-000000000013",
	// device B, source "booru", unknown nsfw
	i14: "01900001-0014-7000-8000-000000000014",
	i15: "01900001-0015-7000-8000-000000000015",
	// soft-deleted
	i16: "01900001-0016-7000-8000-000000000016",
	// blacklisted
	i17: "01900001-0017-7000-8000-000000000017",
	// FTS5 search test rows
	i18: "01900001-0018-7000-8000-000000000018",
	i19: "01900001-0019-7000-8000-000000000019",
	// extra
	i20: "01900001-0020-7000-8000-000000000020",
}

// Stable base timestamp (ms)
const BASE_TIME = 1_700_000_000_000

function make_image(
	id: string,
	index: number,
	opts: {
		source_slug: string
		nsfw: "sfw" | "nsfw" | "unknown"
		deleted?: boolean
		blacklisted?: boolean
		search_text?: string
	},
) {
	return {
		id,
		sha256: `sha256_${index}_${"a".repeat(40 - String(index).length)}`,
		source_slug: opts.source_slug,
		source_id: `src_id_${index}`,
		source_url: `https://example.com/img/${index}`,
		image_url: `https://cdn.example.com/img/${index}.jpg`,
		title: `Image ${index}`,
		filename: `image_${index}.jpg`,
		width: 1920,
		height: 1080,
		file_size: 1024 * (index + 1),
		format: "jpg" as const,
		nsfw: opts.nsfw,
		tags_source: [`tag_source_${index}`],
		search_text: opts.search_text ?? `wallpaper landscape ${index}`,
		created_at_source: BASE_TIME - index * 1000,
		ingested_at: BASE_TIME + index * 1000,
		deleted_at: opts.deleted ? BASE_TIME + 9999 : null,
		blacklisted_at: opts.blacklisted ? BASE_TIME + 9998 : null,
	}
}

export function seed_images(db: DbClient): void {
	// Insert devices first (device_images has FK on device_id)
	db.insert(devices)
		.values([
			{
				id: DEVICE_A,
				slug: "device-a",
				name: "Device A",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			},
			{
				id: DEVICE_B,
				slug: "device-b",
				name: "Device B",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			},
		])
		.run()

	// Insert 20 images
	db.insert(images)
		.values([
			make_image(IMG.i01, 1, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i02, 2, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i03, 3, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i04, 4, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i05, 5, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i06, 6, { source_slug: "reddit", nsfw: "nsfw" }),
			make_image(IMG.i07, 7, { source_slug: "reddit", nsfw: "nsfw" }),
			make_image(IMG.i08, 8, { source_slug: "booru", nsfw: "sfw" }),
			make_image(IMG.i09, 9, { source_slug: "booru", nsfw: "sfw" }),
			make_image(IMG.i10, 10, { source_slug: "booru", nsfw: "sfw" }),
			make_image(IMG.i11, 11, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i12, 12, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i13, 13, { source_slug: "reddit", nsfw: "sfw" }),
			make_image(IMG.i14, 14, { source_slug: "booru", nsfw: "unknown" }),
			make_image(IMG.i15, 15, { source_slug: "booru", nsfw: "unknown" }),
			make_image(IMG.i16, 16, { source_slug: "reddit", nsfw: "sfw", deleted: true }),
			make_image(IMG.i17, 17, { source_slug: "reddit", nsfw: "sfw", blacklisted: true }),
			make_image(IMG.i18, 18, {
				source_slug: "reddit",
				nsfw: "sfw",
				search_text: "cat on a roof",
			}),
			make_image(IMG.i19, 19, {
				source_slug: "booru",
				nsfw: "sfw",
				search_text: "dog in the park",
			}),
			make_image(IMG.i20, 20, { source_slug: "booru", nsfw: "sfw" }),
		])
		.run()

	// Device images: device A gets i01-i10, device B gets i11-i20
	const device_a_images = [
		IMG.i01,
		IMG.i02,
		IMG.i03,
		IMG.i04,
		IMG.i05,
		IMG.i06,
		IMG.i07,
		IMG.i08,
		IMG.i09,
		IMG.i10,
	]
	const device_b_images = [
		IMG.i11,
		IMG.i12,
		IMG.i13,
		IMG.i14,
		IMG.i15,
		IMG.i16,
		IMG.i17,
		IMG.i18,
		IMG.i19,
		IMG.i20,
	]

	db.insert(device_images)
		.values([
			...device_a_images.map((image_id) => ({
				device_id: DEVICE_A,
				image_id,
				on_disk_path: `/data/device-a/${image_id}.jpg`,
				linked_at: BASE_TIME,
			})),
			...device_b_images.map((image_id) => ({
				device_id: DEVICE_B,
				image_id,
				on_disk_path: `/data/device-b/${image_id}.jpg`,
				linked_at: BASE_TIME,
			})),
		])
		.run()

	// Favorites: i01, i02, i11 are favorited
	db.insert(favorites)
		.values([
			{ image_id: IMG.i01, favorited_at: BASE_TIME },
			{ image_id: IMG.i02, favorited_at: BASE_TIME },
			{ image_id: IMG.i11, favorited_at: BASE_TIME },
		])
		.run()

	// User tags: i01 has "landscape" and "nature", i03 has "city"
	db.insert(image_user_tags)
		.values([
			{ image_id: IMG.i01, tag: "landscape", created_at: BASE_TIME },
			{ image_id: IMG.i01, tag: "nature", created_at: BASE_TIME },
			{ image_id: IMG.i03, tag: "city", created_at: BASE_TIME },
		])
		.run()
}
