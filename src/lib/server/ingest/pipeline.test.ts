/**
 * Integration tests for pipeline.run_subscription.
 *
 * Invocation 2: minimal smoke test (empty source).
 * Invocation 3: full integration test suite covering happy path, dedup,
 * re_fan_out, blacklisted skip, filter reject, max_items, and source throw.
 *
 * Fetch mocking pattern: `spyOn(globalThis, "fetch")` returns a fake
 * Response whose body streams a small in-memory PNG buffer. This intercepts
 * the `fetch(item.image_url, ...)` call inside pipeline.ts without needing
 * `mock.module` or any module-level rewiring.
 *
 * Test cleanup: each test creates its own unique tmpdir and removes it in
 * afterEach. The shared TEST_DATA_DIR from beforeAll is only kept for the
 * legacy smoke test and torn down in afterAll.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdirSync, rmSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { and, eq } from "drizzle-orm"
import { uuidv7 } from "uuidv7"
import { create_test_db } from "$test/db"
import {
	device_images,
	device_subscriptions,
	devices,
	images,
	run_history,
	subscriptions,
} from "$lib/server/db/schema"
import { sources } from "$lib/server/sources/_registry"
import { run_subscription } from "./pipeline"
import type { Runtime } from "../bootstrap"
import type { SourceModule } from "../sources/_types"

// ---------------------------------------------------------------------------
// Tiny PNG (100 × 100, ~305 bytes) — used as stub download body.
// Generated once at module load via: sharp({ create: ... }).png().toBuffer()
// ---------------------------------------------------------------------------
const TINY_PNG_B64 =
	"iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA40lEQVR4nO3QIQEAAAjAMPonIxYVuN/01Wd5m3+KWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZgVmBWYFZ+591jYyS1sQgh7gAAAAASUVORK5CYII="

// Decode once
const TINY_PNG = Buffer.from(TINY_PNG_B64, "base64")

// ---------------------------------------------------------------------------
// Helper: build a minimal fetch stub returning the tiny PNG
// ---------------------------------------------------------------------------
function make_fetch_stub(overrides?: { ok?: boolean; status?: number; contentType?: string }) {
	const ok = overrides?.ok ?? true
	const status = overrides?.status ?? 200
	const ct = overrides?.contentType ?? "image/png"

	const fn = async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
		if (!ok) {
			return new Response(null, { status, headers: { "content-type": ct } })
		}
		// Return a ReadableStream-backed Response so the pipeline's `for await (const chunk of res.body)` works.
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(TINY_PNG)
				controller.close()
			},
		})
		return new Response(stream, {
			status,
			headers: { "content-type": ct },
		})
	}
	// Cast to typeof fetch — Bun's fetch type has extra properties (preconnect)
	// that our stub doesn't implement. At runtime, the pipeline only calls
	// fetch(url, init) and reads res.ok + res.headers + res.body; the cast is safe.
	return fn as unknown as typeof fetch
}

// ---------------------------------------------------------------------------
// Helper: seed DB with subscription + devices, return IDs
// ---------------------------------------------------------------------------
type SeedResult = {
	sub_id: string
	device1_id: string
	device2_id: string
}

function seed_subscription_and_two_devices(
	db: ReturnType<typeof create_test_db>,
	data_dir: string,
): SeedResult {
	const sub_id = uuidv7()
	const device1_id = uuidv7()
	const device2_id = uuidv7()
	const BASE_TIME = Date.now()

	db.insert(devices)
		.values({
			id: device1_id,
			slug: "device-alpha",
			name: "Device Alpha",
			enabled: true,
			filter_criteria: { nsfw: "all" },
			created_at: BASE_TIME,
		})
		.run()

	db.insert(devices)
		.values({
			id: device2_id,
			slug: "device-beta",
			name: "Device Beta",
			enabled: true,
			filter_criteria: { nsfw: "all" },
			created_at: BASE_TIME,
		})
		.run()

	db.insert(subscriptions)
		.values({
			id: sub_id,
			source_slug: "mock-test",
			name: "Integration Test Sub",
			input_params: {},
			cron: "0 * * * *",
			enabled: true,
			max_items_inspected: 10,
			created_at: BASE_TIME,
		})
		.run()

	db.insert(device_subscriptions)
		.values({ device_id: device1_id, subscription_id: sub_id, created_at: BASE_TIME })
		.run()

	db.insert(device_subscriptions)
		.values({ device_id: device2_id, subscription_id: sub_id, created_at: BASE_TIME })
		.run()

	// ensure device dirs
	mkdirSync(join(data_dir, "device-alpha"), { recursive: true })
	mkdirSync(join(data_dir, "device-beta"), { recursive: true })

	return { sub_id, device1_id, device2_id }
}

// ---------------------------------------------------------------------------
// Per-test tmpdir helpers
// ---------------------------------------------------------------------------
let current_test_dir: string

function make_test_dir(): string {
	const d = join(
		tmpdir(),
		`wallrus-pipeline-int-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	)
	mkdirSync(d, { recursive: true })
	return d
}

// ---------------------------------------------------------------------------
// Legacy smoke test setup (invocation 2 - kept as-is)
// ---------------------------------------------------------------------------
const TEST_DATA_DIR = join(tmpdir(), `wallrus-pipeline-test-${Date.now()}`)

beforeAll(() => {
	mkdirSync(TEST_DATA_DIR, { recursive: true })
})

afterAll(() => {
	try {
		rmSync(TEST_DATA_DIR, { recursive: true, force: true })
	} catch {
		// best-effort cleanup
	}
	delete sources["mock-test"]
})

// ---------------------------------------------------------------------------
// Per-test setup/teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
	current_test_dir = make_test_dir()
})

afterEach(() => {
	// Clean up per-test tmpdir
	try {
		rmSync(current_test_dir, { recursive: true, force: true })
	} catch {
		// best-effort
	}
	// Always remove mock source and restore mocks
	delete sources["mock-test"]
})

// ---------------------------------------------------------------------------
// Source item fixture
// ---------------------------------------------------------------------------
const ITEM_FIXTURE = {
	source_id: "img-001",
	title: "Test Wallpaper",
	source_url: "https://example.com/posts/img-001",
	image_url: "https://cdn.example.com/img-001.png",
	filename: "img-001",
	width: 100,
	height: 100,
	format: "png" as const,
	tags: ["nature", "landscape"],
	nsfw: "sfw" as const,
}

// ---------------------------------------------------------------------------
// Smoke test: empty source → run_history row created with status=success
// ---------------------------------------------------------------------------

describe("run_subscription (smoke)", () => {
	test("creates run_history row with status=success when source yields nothing", async () => {
		const db = create_test_db()

		const mock_source: SourceModule = {
			slug: "mock-test",
			display_name: "Mock Test Source",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				// Yield nothing — empty source
			},
		}

		sources["mock-test"] = mock_source

		const device_id = uuidv7()
		const sub_id = uuidv7()
		const BASE_TIME = Date.now()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "test-device",
				name: "Test Device",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "Test Subscription",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 10,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({
				device_id,
				subscription_id: sub_id,
				created_at: BASE_TIME,
			})
			.run()

		const runtime = {
			env: { WALLRUS_DATA_DIR: TEST_DATA_DIR },
			db,
		} as unknown as Runtime

		await run_subscription(runtime, sub_id)

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})

		expect(run_row).toBeDefined()
		expect(run_row!.status).toBe("success")
		expect(run_row!.stop_reason).toBe("source_exhausted")
		expect(run_row!.items_seen).toBe(0)
		expect(run_row!.ended_at).not.toBeNull()

		delete sources["mock-test"]
	})
})

// ---------------------------------------------------------------------------
// Integration test suite
// ---------------------------------------------------------------------------

describe("run_subscription (integration)", () => {
	// 1. Happy path
	test("happy path: 1 new image, 2 devices → 2 device_images rows + hardlinks + thumbnail", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const { sub_id } = seed_subscription_and_two_devices(db, data_dir)

		// Register mock source yielding one item
		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				yield { ...ITEM_FIXTURE }
			},
		} as SourceModule

		// Stub globalThis.fetch
		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(make_fetch_stub())

		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime

		await run_subscription(runtime, sub_id)

		fetch_spy.mockRestore()

		// Assert run_history
		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row).toBeDefined()
		expect(run_row!.status).toBe("success")
		expect(run_row!.items_seen).toBe(1)
		expect(run_row!.items_new).toBe(1)
		expect(run_row!.items_skipped_no_device).toBe(0)

		// Assert 1 images row
		const img_rows = await db.query.images.findMany()
		expect(img_rows).toHaveLength(1)

		// Assert 2 device_images rows
		const di_rows = await db.query.device_images.findMany({
			where: eq(device_images.image_id, img_rows[0]!.id),
		})
		expect(di_rows).toHaveLength(2)

		// Assert hardlinks: both paths exist and share same inode
		const path1 = di_rows.find((r) => r.on_disk_path.includes("device-alpha"))?.on_disk_path
		const path2 = di_rows.find((r) => r.on_disk_path.includes("device-beta"))?.on_disk_path
		expect(path1).toBeDefined()
		expect(path2).toBeDefined()
		expect(existsSync(path1!)).toBe(true)
		expect(existsSync(path2!)).toBe(true)
		const ino1 = statSync(path1!).ino
		const ino2 = statSync(path2!).ino
		expect(ino1).toBe(ino2)

		// Assert thumbnail
		const thumb_path = join(data_dir, ".thumbs", `${img_rows[0]!.id}.webp`)
		expect(existsSync(thumb_path)).toBe(true)
	})

	// 2. Dedup by URL
	test("dedup by URL: skip_already_present, no new image row, items_new=0", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const { sub_id } = seed_subscription_and_two_devices(db, data_dir)

		// Pre-seed image with same source_url
		const existing_id = uuidv7()
		db.insert(images)
			.values({
				id: existing_id,
				sha256: "aaaa".repeat(16),
				source_slug: "mock-test",
				source_id: "img-001",
				source_url: ITEM_FIXTURE.source_url,
				image_url: ITEM_FIXTURE.image_url,
				title: ITEM_FIXTURE.title,
				filename: ITEM_FIXTURE.filename,
				width: 100,
				height: 100,
				file_size: 305,
				format: "png",
				nsfw: "sfw",
				tags_source: [],
				ingested_at: Date.now(),
			})
			.run()

		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				yield { ...ITEM_FIXTURE }
			},
		} as SourceModule

		// fetch should NOT be called (URL match before download)
		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(
			(async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
		)

		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)

		fetch_spy.mockRestore()

		// fetch should not have been called
		expect(fetch_spy).not.toHaveBeenCalled()

		// Still only 1 images row (the pre-seeded one)
		const img_rows = await db.query.images.findMany()
		expect(img_rows).toHaveLength(1)

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row!.items_seen).toBe(1)
		expect(run_row!.items_new).toBe(0)
	})

	// 3. Dedup by sha256 → re_fan_out
	test("dedup by sha256: different URL, new device gets hardlink, no new image row", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const BASE_TIME = Date.now()

		// Create ONE device with an existing image
		const device1_id = uuidv7()
		db.insert(devices)
			.values({
				id: device1_id,
				slug: "device-alpha",
				name: "Device Alpha",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		const sub_id = uuidv7()
		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "SHA256 Re-fanout Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 10,
				created_at: BASE_TIME,
			})
			.run()
		db.insert(device_subscriptions)
			.values({ device_id: device1_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		// Compute actual sha256 of TINY_PNG
		const hasher = new Bun.CryptoHasher("sha256")
		hasher.update(TINY_PNG)
		const known_sha256 = hasher.digest("hex")

		// Pre-seed image with the known sha256 but a DIFFERENT source_url
		const existing_id = uuidv7()
		const existing_filename = "original-img"
		db.insert(images)
			.values({
				id: existing_id,
				sha256: known_sha256,
				source_slug: "mock-test",
				source_id: "original-001",
				source_url: "https://example.com/posts/original-001",
				image_url: "https://cdn.example.com/original-001.png",
				title: "Original",
				filename: existing_filename,
				width: 100,
				height: 100,
				file_size: TINY_PNG.byteLength,
				format: "png",
				nsfw: "sfw",
				tags_source: [],
				ingested_at: BASE_TIME,
			})
			.run()

		// Pre-seed device_image for device1 pointing to a file on disk
		mkdirSync(join(data_dir, "device-alpha"), { recursive: true })
		const existing_on_disk = join(
			data_dir,
			"device-alpha",
			`mock-test-${existing_filename}.png`,
		)
		await Bun.write(existing_on_disk, TINY_PNG)
		db.insert(device_images)
			.values({
				device_id: device1_id,
				image_id: existing_id,
				on_disk_path: existing_on_disk,
				linked_at: BASE_TIME,
			})
			.run()

		// Add a SECOND device that does NOT yet have the image
		const device2_id = uuidv7()
		db.insert(devices)
			.values({
				id: device2_id,
				slug: "device-beta",
				name: "Device Beta",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()
		db.insert(device_subscriptions)
			.values({ device_id: device2_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()
		mkdirSync(join(data_dir, "device-beta"), { recursive: true })

		// Mock source yields item with DIFFERENT source_url but same image bytes
		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				yield {
					source_id: "img-duplicate",
					title: "Duplicate via different URL",
					source_url: "https://example.com/posts/img-duplicate",
					image_url: "https://cdn.example.com/img-duplicate.png",
					filename: "img-duplicate",
					width: 100,
					height: 100,
					format: "png" as const,
					tags: [],
					nsfw: "sfw" as const,
				}
			},
		} as SourceModule

		// Stub fetch to return same TINY_PNG bytes
		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(make_fetch_stub())
		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)
		fetch_spy.mockRestore()

		// Still only 1 images row
		const img_rows = await db.query.images.findMany()
		expect(img_rows).toHaveLength(1)

		// device2 should now have a device_images row
		const di_for_device2 = await db.query.device_images.findFirst({
			where: and(
				eq(device_images.device_id, device2_id),
				eq(device_images.image_id, existing_id),
			),
		})
		expect(di_for_device2).toBeDefined()

		// The newly linked file should share the same inode as the canonical
		expect(existsSync(di_for_device2!.on_disk_path)).toBe(true)
		expect(statSync(di_for_device2!.on_disk_path).ino).toBe(statSync(existing_on_disk).ino)
	})

	// 4. Blacklisted skip
	test("blacklisted URL: skip entirely, no download attempted", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const { sub_id } = seed_subscription_and_two_devices(db, data_dir)

		// Pre-seed blacklisted image
		const existing_id = uuidv7()
		db.insert(images)
			.values({
				id: existing_id,
				sha256: "bbbb".repeat(16),
				source_slug: "mock-test",
				source_id: "img-001",
				source_url: ITEM_FIXTURE.source_url,
				image_url: ITEM_FIXTURE.image_url,
				title: ITEM_FIXTURE.title,
				filename: ITEM_FIXTURE.filename,
				width: 100,
				height: 100,
				file_size: 305,
				format: "png",
				nsfw: "sfw",
				tags_source: [],
				ingested_at: Date.now(),
				blacklisted_at: Date.now() - 1000,
			})
			.run()

		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				yield { ...ITEM_FIXTURE }
			},
		} as SourceModule

		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(
			(async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
		)

		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)
		fetch_spy.mockRestore()

		// fetch must not have been called
		expect(fetch_spy).not.toHaveBeenCalled()

		// No device_images inserted
		const di_rows = await db.query.device_images.findMany()
		expect(di_rows).toHaveLength(0)

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row!.items_seen).toBe(1)
		expect(run_row!.items_new).toBe(0)
	})

	// 5. Filters reject all
	test("filters reject all: items_skipped_no_device=1, no image row", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const BASE_TIME = Date.now()
		const sub_id = uuidv7()
		const device_id = uuidv7()

		// Device with very high min_width
		db.insert(devices)
			.values({
				id: device_id,
				slug: "picky-device",
				name: "Picky Device",
				enabled: true,
				filter_criteria: { nsfw: "all", min_width: 99999 },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "Filter Reject Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 10,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({ device_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		mkdirSync(join(data_dir, "picky-device"), { recursive: true })

		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				yield { ...ITEM_FIXTURE }
			},
		} as SourceModule

		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(make_fetch_stub())
		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)
		fetch_spy.mockRestore()

		const img_rows = await db.query.images.findMany()
		expect(img_rows).toHaveLength(0)

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row!.items_skipped_no_device).toBe(1)
		expect(run_row!.items_new).toBe(0)
	})

	// 6. max_items_inspected hit
	test("max_items_inspected: loop breaks after 2 items, stop_reason=max_items_inspected", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const BASE_TIME = Date.now()
		const sub_id = uuidv7()
		const device_id = uuidv7()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "device-alpha",
				name: "Device Alpha",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "Max Items Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 2, // limit to 2
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({ device_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		mkdirSync(join(data_dir, "device-alpha"), { recursive: true })

		// Source yields 5 items with distinct URLs/filenames
		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			async *fetch() {
				for (let i = 1; i <= 5; i++) {
					yield {
						source_id: `img-00${i}`,
						title: `Image ${i}`,
						source_url: `https://example.com/posts/img-00${i}`,
						image_url: `https://cdn.example.com/img-00${i}.png`,
						filename: `img-00${i}`,
						width: 100,
						height: 100,
						format: "png" as const,
						tags: [],
						nsfw: "sfw" as const,
					}
				}
			},
		} as SourceModule

		const fetch_spy = spyOn(globalThis, "fetch").mockImplementation(make_fetch_stub())
		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)
		fetch_spy.mockRestore()

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row!.stop_reason).toBe("max_items_inspected")
		expect(run_row!.items_seen).toBe(2)
	})

	// 7. Source throws
	test("source throws: run marked failed, stop_reason=error, error field set", async () => {
		const db = create_test_db()
		const data_dir = current_test_dir
		const BASE_TIME = Date.now()
		const sub_id = uuidv7()
		const device_id = uuidv7()

		db.insert(devices)
			.values({
				id: device_id,
				slug: "device-alpha",
				name: "Device Alpha",
				enabled: true,
				filter_criteria: { nsfw: "all" },
				created_at: BASE_TIME,
			})
			.run()

		db.insert(subscriptions)
			.values({
				id: sub_id,
				source_slug: "mock-test",
				name: "Source Throws Sub",
				input_params: {},
				cron: "0 * * * *",
				enabled: true,
				max_items_inspected: 10,
				created_at: BASE_TIME,
			})
			.run()

		db.insert(device_subscriptions)
			.values({ device_id, subscription_id: sub_id, created_at: BASE_TIME })
			.run()

		mkdirSync(join(data_dir, "device-alpha"), { recursive: true })

		// Source throws on first yield (the throw is raised inside the for-await loop in pipeline)
		sources["mock-test"] = {
			slug: "mock-test",
			display_name: "Mock Test",
			params_schema: {
				safeParse: (v: unknown) =>
					({ success: true, data: v }) as ReturnType<
						SourceModule["params_schema"]["safeParse"]
					>,
				parse: (v: unknown) => v,
			} as SourceModule["params_schema"],
			// eslint-disable-next-line require-yield
			async *fetch() {
				throw new Error("source network failure")
			},
		} as SourceModule

		const runtime = { env: { WALLRUS_DATA_DIR: data_dir }, db } as unknown as Runtime
		await run_subscription(runtime, sub_id)

		const run_row = await db.query.run_history.findFirst({
			where: eq(run_history.subscription_id, sub_id),
		})
		expect(run_row!.status).toBe("failed")
		expect(run_row!.stop_reason).toBe("error")
		expect(run_row!.error).toContain("source network failure")
	})
})
