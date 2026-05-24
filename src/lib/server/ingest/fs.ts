/**
 * Filesystem helpers for the ingest pipeline.
 *
 * - `atomic_write`  — rename temp → final on same FS; cross-FS fallback via copy+unlink.
 * - `link_or_copy`  — hardlink src → dst; EXDEV/EPERM fallback to file copy.
 * - `compute_thumbnail` — sharp: rotate (EXIF) → resize inside 512×512 → webp q80.
 *
 * Hardlinks share the inode AND permissions. Callers must ensure the source blob
 * is chmod 0644 before calling `link_or_copy`.
 */

import { copyFileSync, unlinkSync } from "node:fs"
import { link, copyFile } from "node:fs/promises"
import { renameSync } from "node:fs"
import sharp from "sharp"

// ---------------------------------------------------------------------------
// atomic_write
// ---------------------------------------------------------------------------

/**
 * Atomically move `temp_path` → `final_path`.
 *
 * Uses `fs.renameSync` when both paths are on the same filesystem.
 * Falls back to copy+unlink when the rename crosses a filesystem boundary
 * (EXDEV error from the OS).
 */
export async function atomic_write(temp_path: string, final_path: string): Promise<void> {
	try {
		renameSync(temp_path, final_path)
	} catch (err: unknown) {
		const e = err as NodeJS.ErrnoException
		if (e.code === "EXDEV") {
			copyFileSync(temp_path, final_path)
			unlinkSync(temp_path)
			return
		}
		throw err
	}
}

// ---------------------------------------------------------------------------
// link_or_copy
// ---------------------------------------------------------------------------

/**
 * Create a hardlink from `src` to `dst`.
 *
 * If the hardlink fails because the two paths are on different filesystems
 * (EXDEV) or because the OS/FS does not support hardlinks (EPERM), falls
 * back to a byte-for-byte copy.
 *
 * Callers must ensure the parent directory of `dst` already exists.
 */
export async function link_or_copy(src: string, dst: string): Promise<void> {
	try {
		await link(src, dst)
	} catch (err: unknown) {
		const e = err as NodeJS.ErrnoException
		if (e.code === "EXDEV" || e.code === "EPERM") {
			await copyFile(src, dst)
			return
		}
		throw err
	}
}

// ---------------------------------------------------------------------------
// compute_thumbnail
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail from `blob_path` and write it to `thumb_path`.
 *
 * Pipeline:
 *   1. `.rotate()` — honour EXIF orientation BEFORE resizing (critical: otherwise
 *      portrait photos are processed as landscape, producing wrong dimensions).
 *   2. `.resize(512, 512, { fit: "inside", withoutEnlargement: true })` — shrink
 *      to fit within 512×512 while preserving aspect ratio; never upscale.
 *   3. `.webp({ quality: 80 })` — output format.
 *
 * The caller is responsible for ensuring `thumb_path`'s parent directory exists.
 */
export async function compute_thumbnail(blob_path: string, thumb_path: string): Promise<void> {
	await sharp(blob_path)
		.rotate()
		.resize(512, 512, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 80 })
		.toFile(thumb_path)
}
