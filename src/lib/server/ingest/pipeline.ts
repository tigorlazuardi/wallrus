/**
 * Ingest pipeline — drives a source's async generator, dedups, downloads,
 * evaluates per-device filters, writes blobs + thumbnails, fans out via
 * hardlink (copy fallback), inserts image + junction rows, and updates
 * run_history counters.
 *
 * Entry point: `run_subscription(runtime, subscription_id)`
 *
 * Data layout (per SCOPE.md §Storage):
 *   <base-dir>/<device-slug>/<source-slug>-<filename>.<ext>
 *   <base-dir>/.thumbs/<image-uuid>.webp
 *   <base-dir>/.tmp/<run-id>-<seq>          (temp during download)
 *
 * The first matching device is canonical — subsequent devices hardlink to it.
 */

import { and, eq, isNull } from "drizzle-orm"
import { mkdirSync, chmodSync, unlinkSync, existsSync } from "node:fs"
import { uuidv7 } from "uuidv7"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"
import { getLogger, withTrace } from "@tigorhutasuhut/telemetry-js/bun"
import { join } from "node:path"
import type { Runtime } from "../bootstrap"
import {
	device_images,
	device_subscriptions,
	devices,
	images,
	run_history,
	source_credentials,
	subscriptions,
	type Device,
} from "../db/schema"
import { get_source } from "../sources/_registry"
import { make_source_context } from "../sources/_context"
import { check } from "./dedup"
import { evaluate, type ImageMeta } from "./filters"
import { atomic_write, compute_thumbnail, link_or_copy } from "./fs"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extension inferred from format string or content-type header. */
type KnownExt = "jpg" | "png" | "webp" | "avif"

const FORMAT_TO_EXT: Record<KnownExt, string> = {
	jpg: "jpg",
	png: "png",
	webp: "webp",
	avif: "avif",
}

const CONTENT_TYPE_TO_EXT: Record<string, KnownExt> = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/avif": "avif",
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ext_from_content_type(ct: string | null): KnownExt | undefined {
	if (!ct) return undefined
	const base = (ct.split(";")[0] ?? ct).trim().toLowerCase()
	return CONTENT_TYPE_TO_EXT[base]
}

function ext_from_url(url: string): KnownExt | undefined {
	const path = new URL(url).pathname.toLowerCase()
	const dot = path.lastIndexOf(".")
	if (dot < 0) return undefined
	const raw = path.slice(dot + 1)
	if (raw === "jpg" || raw === "jpeg") return "jpg"
	if (raw === "png") return "png"
	if (raw === "webp") return "webp"
	if (raw === "avif") return "avif"
	return undefined
}

function ensure_dir(dir_path: string): void {
	mkdirSync(dir_path, { recursive: true, mode: 0o755 })
}

// ---------------------------------------------------------------------------
// run_subscription
// ---------------------------------------------------------------------------

/**
 * Execute one subscription ingest run to completion.
 *
 * - Opens a `run_history` row with `status: "running"` at the start.
 * - Iterates the source's async generator sequentially.
 * - On success → `status: "success"`, `stop_reason: "source_exhausted"` (or
 *   `"max_items_inspected"` if the loop was cut short).
 * - On source-level throw → `status: "failed"`, `stop_reason: "error"`.
 * - Per-item errors increment `items_failed_download` and continue.
 */
export async function run_subscription(runtime: Runtime, subscription_id: string): Promise<void> {
	return withTrace(async function run_subscription_trace() {
		const log = getLogger()
		const { db, env } = runtime
		const data_dir = env.WALLRUS_DATA_DIR

		// -------------------------------------------------------------------
		// 1. Load subscription
		// -------------------------------------------------------------------
		const sub = await withQueryName("ingest.load_subscription", () =>
			db.query.subscriptions.findFirst({
				where: and(eq(subscriptions.id, subscription_id), isNull(subscriptions.deleted_at)),
			}),
		)
		if (!sub) {
			throw AppError.fail(`subscription not found: ${subscription_id}`, {
				status: 404,
				fields: { subscription_id },
			})
		}

		const source = get_source(sub.source_slug)
		if (!source) {
			throw AppError.fail(`source not registered: ${sub.source_slug}`, {
				fields: { source_slug: sub.source_slug },
			})
		}

		// Load credentials (may be null)
		const cred_row = await withQueryName("ingest.load_credentials", () =>
			db.query.source_credentials.findFirst({
				where: eq(source_credentials.source_slug, sub.source_slug),
			}),
		)

		let parsed_credential: unknown = undefined
		if (cred_row && source.credential) {
			const parse_result = source.credential.schema.safeParse(cred_row.payload)
			if (parse_result.success) {
				parsed_credential = parse_result.data
			} else {
				log.warn("credential parse failed, running anonymous", {
					module: "ingest",
					source_slug: sub.source_slug,
					subscription_id,
				})
			}
		}

		// Load enabled, non-deleted devices subscribed to this subscription
		const subscribed_devices: Device[] = await withQueryName("ingest.load_devices", () =>
			db
				.select({ device: devices })
				.from(device_subscriptions)
				.innerJoin(devices, eq(device_subscriptions.device_id, devices.id))
				.where(
					and(
						eq(device_subscriptions.subscription_id, subscription_id),
						eq(devices.enabled, true),
					),
				)
				.all()
				.map((r) => r.device),
		)

		// -------------------------------------------------------------------
		// 2. Open run_history row
		// -------------------------------------------------------------------
		const run_id = uuidv7()

		await withQueryName("ingest.insert_run", () =>
			db.insert(run_history).values({
				id: run_id,
				subscription_id,
				started_at: Date.now(),
				status: "running",
				input_params_snapshot: sub.input_params,
				items_seen: 0,
				items_new: 0,
				items_failed_download: 0,
				items_skipped_no_device: 0,
				device_adds: {},
			}),
		)

		log.info("ingest run started", {
			module: "ingest",
			run_id,
			subscription_id,
			source_slug: sub.source_slug,
			devices: subscribed_devices.length,
		})

		// -------------------------------------------------------------------
		// 3. Ensure directories exist
		// -------------------------------------------------------------------
		const tmp_dir = join(data_dir, ".tmp")
		const thumbs_dir = join(data_dir, ".thumbs")
		ensure_dir(tmp_dir)
		ensure_dir(thumbs_dir)
		for (const dev of subscribed_devices) {
			ensure_dir(join(data_dir, dev.slug))
		}

		// -------------------------------------------------------------------
		// 4. Iterate source generator
		// -------------------------------------------------------------------

		// In-memory counters — flushed to DB on finalize
		let items_seen = 0
		let items_new = 0
		let items_failed_download = 0
		let items_skipped_no_device = 0
		const device_adds: Record<string, number> = {}
		let stop_reason: "source_exhausted" | "max_items_inspected" | "error" = "source_exhausted"
		let run_error: string | undefined = undefined

		const max_items = sub.max_items_inspected ?? 300
		const abort_ctrl = new AbortController()

		const ctx = make_source_context({
			abort: abort_ctrl.signal,
			log: (level, msg, kv) => {
				log[level](msg, { module: `source.${sub.source_slug}`, ...kv })
			},
		})

		const generator = source.fetch(ctx, sub.input_params, parsed_credential)

		try {
			let seq = 0
			for await (const item of generator) {
				items_seen++

				// -----------------------------------------------------------
				// Stage 1 dedup: pre-download URL check
				// -----------------------------------------------------------
				const stage1 = await check(db, { source_url: item.source_url })

				if (stage1.kind === "skip_blacklisted") {
					log.debug("skip blacklisted (url)", {
						module: "ingest",
						source_url: item.source_url,
					})
					// Check max_items before continuing
					if (items_seen >= max_items) {
						stop_reason = "max_items_inspected"
						break
					}
					continue
				}

				if (stage1.kind === "skip_already_present") {
					// Fully present and not soft-deleted — evaluate re-fan-out for
					// newly added devices. For MVP we skip re-fan-out on skip_already_present
					// to keep the flow simple; re_fan_out from sha256 collision handles the
					// cross-URL case.
					log.debug("skip already present", {
						module: "ingest",
						source_url: item.source_url,
					})
					if (items_seen >= max_items) {
						stop_reason = "max_items_inspected"
						break
					}
					continue
				}

				// re_fan_out from stage1 = soft-deleted; fall through to download + re-evaluate.
				const is_resurrection = stage1.kind === "re_fan_out"

				// -----------------------------------------------------------
				// Per-item try/catch: errors increment counter and continue
				// -----------------------------------------------------------
				try {
					seq++
					const temp_path = join(tmp_dir, `${run_id}-${seq}`)

					// --------------------------------------------------------
					// Download
					// --------------------------------------------------------
					const res = await fetch(item.image_url, {
						signal: AbortSignal.timeout(30_000),
						redirect: "follow",
					})

					if (!res.ok) {
						throw new Error(`HTTP ${res.status} fetching ${item.image_url}`)
					}

					// Determine file extension
					const ct = res.headers.get("content-type")
					const ext: string =
						(item.format ? FORMAT_TO_EXT[item.format] : undefined) ??
						ext_from_content_type(ct) ??
						ext_from_url(item.image_url) ??
						"jpg" // fallback

					// Stream body to temp file, compute sha256 in parallel
					const hasher = new Bun.CryptoHasher("sha256")
					const writer = Bun.file(temp_path).writer()
					let byte_count = 0

					if (!res.body) {
						throw new Error(`no response body for ${item.image_url}`)
					}

					for await (const chunk of res.body) {
						hasher.update(chunk)
						writer.write(chunk)
						byte_count += chunk.byteLength
					}
					await writer.end()

					// Secure temp file permissions
					chmodSync(temp_path, 0o600)

					const sha256 = hasher.digest("hex")
					const file_size = byte_count > 0 ? byte_count : Bun.file(temp_path).size

					// Probe metadata if needed
					let width = item.width
					let height = item.height
					let format: string = item.format ?? ext

					if (width === undefined || height === undefined) {
						try {
							const sharp = (await import("sharp")).default
							const meta = await sharp(temp_path).metadata()
							width = meta.width ?? 0
							height = meta.height ?? 0
							if (!item.format && meta.format) {
								// sharp returns 'jpeg' for jpg
								format = meta.format === "jpeg" ? "jpg" : (meta.format as string)
							}
						} catch {
							width = width ?? 0
							height = height ?? 0
						}
					}

					// --------------------------------------------------------
					// Stage 2 dedup: post-download sha256 check
					// --------------------------------------------------------
					const stage2 = await check(db, { source_url: item.source_url, sha256 })

					if (stage2.kind === "skip_blacklisted") {
						log.debug("skip blacklisted (sha256)", {
							module: "ingest",
							sha256,
							source_url: item.source_url,
						})
						unlinkSync(temp_path)
						if (items_seen >= max_items) {
							stop_reason = "max_items_inspected"
							break
						}
						continue
					}

					const is_sha256_refanout = stage2.kind === "re_fan_out" && !is_resurrection

					// --------------------------------------------------------
					// Evaluate filters across enabled devices
					// --------------------------------------------------------
					const valid_format = ["jpg", "png", "webp", "avif"].includes(format)
						? (format as "jpg" | "png" | "webp" | "avif")
						: "jpg"

					const image_meta: ImageMeta = {
						width: width ?? 0,
						height: height ?? 0,
						file_size,
						format: valid_format,
						tags: item.tags,
						nsfw: item.nsfw,
					}

					const matching_devices = subscribed_devices.filter((dev) => {
						const result = evaluate(image_meta, dev.filter_criteria)
						return result.pass
					})

					if (matching_devices.length === 0) {
						// No device wants this image — discard temp file
						unlinkSync(temp_path)
						items_skipped_no_device++
						log.debug("no device matched, skipping", {
							module: "ingest",
							source_url: item.source_url,
						})
						if (items_seen >= max_items) {
							stop_reason = "max_items_inspected"
							break
						}
						continue
					}

					// --------------------------------------------------------
					// Re-fan-out: image already exists by sha256 (different URL) or
					// was soft-deleted and is being resurrected.
					// --------------------------------------------------------
					if (is_sha256_refanout && stage2.kind === "re_fan_out") {
						const existing = stage2.existing

						// Find existing on-disk path from device_images
						const existing_device_image = await withQueryName(
							"ingest.find_existing_device_image",
							() =>
								db.query.device_images.findFirst({
									where: eq(device_images.image_id, existing.id),
								}),
						)

						if (existing_device_image) {
							// Link to any matching devices that don't have this image yet
							for (const dev of matching_devices) {
								const already_linked = await db.query.device_images.findFirst({
									where: and(
										eq(device_images.device_id, dev.id),
										eq(device_images.image_id, existing.id),
									),
								})
								if (!already_linked) {
									const device_path = join(
										data_dir,
										dev.slug,
										`${sub.source_slug}-${existing.filename}.${existing.format === "jpg" ? "jpg" : existing.format}`,
									)
									await link_or_copy(
										existing_device_image.on_disk_path,
										device_path,
									)
									await db.insert(device_images).values({
										device_id: dev.id,
										image_id: existing.id,
										on_disk_path: device_path,
										linked_at: Date.now(),
									})
									device_adds[dev.id] = (device_adds[dev.id] ?? 0) + 1
								}
							}
						}

						unlinkSync(temp_path)
						if (items_seen >= max_items) {
							stop_reason = "max_items_inspected"
							break
						}
						continue
					}

					// --------------------------------------------------------
					// Resurrection: soft-deleted image being re-downloaded
					// --------------------------------------------------------
					if (is_resurrection && stage2.kind === "re_fan_out") {
						const existing = stage2.existing

						// Find canonical on-disk path
						const existing_device_image = await withQueryName(
							"ingest.find_existing_device_image_resurrection",
							() =>
								db.query.device_images.findFirst({
									where: eq(device_images.image_id, existing.id),
								}),
						)

						// Determine final paths and move/link
						let canonical_path: string | undefined
						for (const dev of matching_devices) {
							const device_path = join(
								data_dir,
								dev.slug,
								`${sub.source_slug}-${existing.filename}.${ext}`,
							)
							if (canonical_path === undefined) {
								await atomic_write(temp_path, device_path)
								chmodSync(device_path, 0o644)
								canonical_path = device_path
							} else {
								await link_or_copy(canonical_path, device_path)
							}
							// Upsert device_images row
							await db
								.insert(device_images)
								.values({
									device_id: dev.id,
									image_id: existing.id,
									on_disk_path: device_path,
									linked_at: Date.now(),
								})
								.onConflictDoUpdate({
									target: [device_images.device_id, device_images.image_id],
									set: { on_disk_path: device_path, linked_at: Date.now() },
								})
							device_adds[dev.id] = (device_adds[dev.id] ?? 0) + 1
						}

						// Clear soft-delete
						await db
							.update(images)
							.set({ deleted_at: null })
							.where(eq(images.id, existing.id))

						// Thumbnail (use existing path or regenerate)
						if (canonical_path) {
							const thumb_path = join(thumbs_dir, `${existing.id}.webp`)
							await compute_thumbnail(canonical_path, thumb_path)
						}

						// Clean up if no canonical was created (no matching devices,
						// already handled above but guard here)
						if (!canonical_path && existsSync(temp_path)) {
							unlinkSync(temp_path)
						}

						if (existing_device_image) {
							// suppress unused-var lint
							void existing_device_image
						}
						items_new++
						if (items_seen >= max_items) {
							stop_reason = "max_items_inspected"
							break
						}
						continue
					}

					// --------------------------------------------------------
					// New image: insert row, fan out, thumbnail
					// --------------------------------------------------------
					const image_uuid = uuidv7()
					const safe_format: "jpg" | "png" | "webp" | "avif" = [
						"jpg",
						"png",
						"webp",
						"avif",
					].includes(format)
						? (format as "jpg" | "png" | "webp" | "avif")
						: "jpg"
					const filename_ext = FORMAT_TO_EXT[safe_format]

					// Fan out: first device = canonical (atomic_write), rest = hardlink
					let canonical_path: string | undefined
					for (const dev of matching_devices) {
						const device_path = join(
							data_dir,
							dev.slug,
							`${sub.source_slug}-${item.filename}.${filename_ext}`,
						)
						if (canonical_path === undefined) {
							await atomic_write(temp_path, device_path)
							chmodSync(device_path, 0o644)
							canonical_path = device_path
						} else {
							await link_or_copy(canonical_path, device_path)
						}
					}

					// Insert images row (do this after file is on disk)
					if (canonical_path) {
						const nsfw_val =
							item.nsfw === "sfw" || item.nsfw === "nsfw" || item.nsfw === "unknown"
								? item.nsfw
								: "unknown"

						await withQueryName("ingest.insert_image", () =>
							db.insert(images).values({
								id: image_uuid,
								sha256,
								source_slug: sub.source_slug,
								source_id: item.source_id,
								source_url: item.source_url,
								image_url: item.image_url,
								title: item.title,
								filename: item.filename,
								width: width ?? 0,
								height: height ?? 0,
								file_size,
								format: safe_format,
								nsfw: nsfw_val,
								tags_source: item.tags,
								search_text: item.search_text ?? null,
								created_at_source: item.created_at_source
									? Date.parse(item.created_at_source)
									: null,
								ingested_at: Date.now(),
							}),
						)

						// Insert device_images junction rows
						for (const dev of matching_devices) {
							const device_path = join(
								data_dir,
								dev.slug,
								`${sub.source_slug}-${item.filename}.${filename_ext}`,
							)
							await withQueryName("ingest.insert_device_image", () =>
								db.insert(device_images).values({
									device_id: dev.id,
									image_id: image_uuid,
									on_disk_path: device_path,
									linked_at: Date.now(),
								}),
							)
							device_adds[dev.id] = (device_adds[dev.id] ?? 0) + 1
						}

						// Thumbnail
						const thumb_path = join(thumbs_dir, `${image_uuid}.webp`)
						await compute_thumbnail(canonical_path, thumb_path)

						items_new++
						log.debug("image ingested", {
							module: "ingest",
							image_id: image_uuid,
							source_url: item.source_url,
							devices: matching_devices.length,
						})
					} else {
						// This branch shouldn't happen (matching_devices.length > 0 above)
						// but handle defensively
						if (existsSync(temp_path)) {
							unlinkSync(temp_path)
						}
					}
				} catch (item_err) {
					items_failed_download++
					// Clean up temp file if it was created
					const temp_path = join(tmp_dir, `${run_id}-${seq}`)
					if (existsSync(temp_path)) {
						try {
							unlinkSync(temp_path)
						} catch {
							// best-effort
						}
					}
					log.warn("per-item ingest error", {
						module: "ingest",
						run_id,
						source_url: item.source_url,
						error: item_err instanceof Error ? item_err.message : String(item_err),
					})
				}

				// Check inspected counter limit
				if (items_seen >= max_items) {
					stop_reason = "max_items_inspected"
					break
				}
			}
		} catch (source_err) {
			// Source-level error — mark run failed
			stop_reason = "error"
			run_error = source_err instanceof Error ? source_err.message : String(source_err)
			log.error("ingest source error", {
				module: "ingest",
				run_id,
				subscription_id,
				source_slug: sub.source_slug,
				error: run_error,
			})
		} finally {
			// Abort the source in case the loop broke early
			abort_ctrl.abort()
		}

		// -------------------------------------------------------------------
		// 5. Finalize run_history row
		// -------------------------------------------------------------------
		const final_status = stop_reason === "error" ? "failed" : "success"

		await withQueryName("ingest.finalize_run", () =>
			db
				.update(run_history)
				.set({
					status: final_status,
					stop_reason,
					error: run_error ?? null,
					ended_at: Date.now(),
					items_seen,
					items_new,
					items_failed_download,
					items_skipped_no_device,
					device_adds,
				})
				.where(eq(run_history.id, run_id)),
		)

		log.info("ingest run finished", {
			module: "ingest",
			run_id,
			subscription_id,
			source_slug: sub.source_slug,
			status: final_status,
			stop_reason,
			items_seen,
			items_new,
			items_failed_download,
			items_skipped_no_device,
		})

		// -------------------------------------------------------------------
		// 6. Cleanup orphan temp files for this run
		// -------------------------------------------------------------------
		try {
			const glob = new Bun.Glob(`${run_id}-*`)
			for await (const entry of glob.scan({ cwd: tmp_dir })) {
				const orphan_path = join(tmp_dir, entry)
				try {
					unlinkSync(orphan_path)
				} catch {
					// best-effort
				}
			}
		} catch {
			// best-effort cleanup
		}
	})
}
