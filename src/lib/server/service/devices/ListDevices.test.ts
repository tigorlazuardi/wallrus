import { describe, expect, test } from "bun:test"
import { ListDevicesRequestSchema } from "$lib/schemas/devices/ListDevices"

describe("ListDevices schema", () => {
	test("accepts a bare request with defaults applied", () => {
		const parsed = ListDevicesRequestSchema.parse({})
		expect(parsed.offset).toBe(0)
		expect(parsed.limit).toBe(20)
	})

	test("rejects negative offset", () => {
		expect(() => ListDevicesRequestSchema.parse({ offset: -1 })).toThrow()
	})

	test("rejects limit over 100", () => {
		expect(() => ListDevicesRequestSchema.parse({ limit: 999 })).toThrow()
	})

	test("accepts a `next` cursor as uuid", () => {
		const id = "0193b6f0-1234-7000-8000-000000000000"
		const parsed = ListDevicesRequestSchema.parse({ next: id })
		expect(parsed.next).toBe(id)
	})
})
