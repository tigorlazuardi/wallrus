import { beforeEach, describe, expect, test } from "bun:test"
import { create_test_db } from "$test/db"
import { seed_images, IMG, DEVICE_A, DEVICE_B } from "$test/fixtures/seed_images"
import { ImageService } from "./index"

let db: ReturnType<typeof create_test_db>
let svc: ImageService

beforeEach(() => {
	db = create_test_db()
	svc = new ImageService({ db })
	seed_images(db)
})

describe("listDeviceImages", () => {
	test("returns only images linked to the specified device", async () => {
		const result = await svc.listDeviceImages({ device_id: DEVICE_A, offset: 0, limit: 50 })
		const ids = result.items.map((i) => i.id)
		// Device A: i01-i10
		expect(ids).toContain(IMG.i01)
		expect(ids).toContain(IMG.i10)
		// Device B images should not appear
		expect(ids).not.toContain(IMG.i11)
		expect(ids).not.toContain(IMG.i20)
	})

	test("device B gets its own images", async () => {
		const result = await svc.listDeviceImages({ device_id: DEVICE_B, offset: 0, limit: 50 })
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i11)
		expect(ids).toContain(IMG.i12)
		expect(ids).not.toContain(IMG.i01)
	})

	test("excludes soft-deleted by default", async () => {
		const result = await svc.listDeviceImages({ device_id: DEVICE_B, offset: 0, limit: 50 })
		const ids = result.items.map((i) => i.id)
		// i16 is soft-deleted and linked to device B
		expect(ids).not.toContain(IMG.i16)
	})

	test("excludes blacklisted by default", async () => {
		const result = await svc.listDeviceImages({ device_id: DEVICE_B, offset: 0, limit: 50 })
		const ids = result.items.map((i) => i.id)
		// i17 is blacklisted and linked to device B
		expect(ids).not.toContain(IMG.i17)
	})

	test("include_deleted=true includes soft-deleted device images", async () => {
		const result = await svc.listDeviceImages({
			device_id: DEVICE_B,
			offset: 0,
			limit: 50,
			include_deleted: true,
		})
		const ids = result.items.map((i) => i.id)
		expect(ids).toContain(IMG.i16)
	})

	test("unknown device_id returns empty result", async () => {
		const result = await svc.listDeviceImages({
			device_id: "00000000-dead-7000-8000-000000000000",
			offset: 0,
			limit: 50,
		})
		expect(result.items).toHaveLength(0)
		expect(result.total).toBe(0)
	})
})
