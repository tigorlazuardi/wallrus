/**
 * Unit tests for $lib/client/devices/use-device-mutation.svelte.ts
 *
 * The mutation hook has no internal $state — it is a plain function that
 * returns action functions. We test each action (create, update, delete,
 * toggle) by stubbing globalThis.fetch and verifying:
 *   - Correct HTTP method + path
 *   - Correct request body
 *   - Response is parsed by the appropriate Zod schema
 *   - Non-OK HTTP responses throw with an HTTP status message
 *   - Network errors propagate as-thrown
 */

import { afterEach, describe, expect, test } from "bun:test"
import { set_api_base } from "$lib/client/config"

// ---------------------------------------------------------------------------
// Fake fetch
// ---------------------------------------------------------------------------

type FetchCall = { url: string; method: string; body: unknown }
type FetchStub = (url: string, init?: RequestInit) => Promise<Response>

let _fetch_stub: FetchStub | null = null
const _calls: FetchCall[] = []

const original_fetch = globalThis.fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = (
	url: string | URL | Request,
	init?: RequestInit,
): Promise<Response> => {
	let body: unknown = undefined
	try {
		if (init?.body) body = JSON.parse(init.body as string)
	} catch {
		body = init?.body
	}
	_calls.push({ url: String(url), method: init?.method ?? "GET", body })
	if (_fetch_stub) return _fetch_stub(String(url), init)
	return original_fetch(url as string, init)
}

afterEach(() => {
	_fetch_stub = null
	_calls.splice(0)
	set_api_base("")
})

// ---------------------------------------------------------------------------
// Import hook
// ---------------------------------------------------------------------------

import { useDeviceMutation } from "$lib/client/devices/use-device-mutation.svelte"

// ---------------------------------------------------------------------------
// Sample data fixtures
// ---------------------------------------------------------------------------

const device_id = "018f7e1a-1234-7000-8000-000000000001"

const sample_device = {
	id: device_id,
	slug: "my-phone",
	name: "My Phone",
	enabled: true,
	filter_criteria: { nsfw: "all" as const },
	native_width: 1080,
	native_height: 2340,
	created_at: 1_700_000_000_000,
}

function ok_json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe("useDeviceMutation().create", () => {
	test("POST to /api/v1/devices", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device, 201))
		const { create } = useDeviceMutation()
		await create({
			slug: "my-phone",
			name: "My Phone",
			filter_criteria: { nsfw: "all" },
		})
		expect(_calls[0]!.url).toBe("/api/v1/devices")
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends slug and name in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device, 201))
		const { create } = useDeviceMutation()
		await create({
			slug: "my-phone",
			name: "My Phone",
			filter_criteria: { nsfw: "all" },
		})
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.slug).toBe("my-phone")
		expect(body.name).toBe("My Phone")
	})

	test("valid lowercase slug passes through unchanged", async () => {
		_fetch_stub = () => Promise.resolve(ok_json({ ...sample_device, slug: "my-phone" }, 201))
		const { create } = useDeviceMutation()
		await create({
			slug: "my-phone",
			name: "My Phone",
			filter_criteria: { nsfw: "all" },
		})
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.slug).toBe("my-phone")
	})

	test("returns parsed device from response", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device, 201))
		const { create } = useDeviceMutation()
		const result = await create({
			slug: "my-phone",
			name: "My Phone",
			filter_criteria: { nsfw: "all" },
		})
		expect(result.id).toBe(device_id)
		expect(result.slug).toBe("my-phone")
		expect(result.enabled).toBe(true)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("bad request", { status: 400 }))
		const { create } = useDeviceMutation()
		await expect(
			create({ slug: "x", name: "X", filter_criteria: { nsfw: "all" } }),
		).rejects.toThrow(/HTTP 400/)
	})

	test("prepends api_base when set", async () => {
		set_api_base("http://192.168.1.100:5173")
		_fetch_stub = () => Promise.resolve(ok_json(sample_device, 201))
		const { create } = useDeviceMutation()
		await create({ slug: "my-phone", name: "My Phone", filter_criteria: { nsfw: "all" } })
		expect(_calls[0]!.url).toBe("http://192.168.1.100:5173/api/v1/devices")
	})
})

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe("useDeviceMutation().update", () => {
	test("PATCH to /api/v1/devices/[id]", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device))
		const { update } = useDeviceMutation()
		await update({ id: device_id, name: "Renamed Phone" })
		expect(_calls[0]!.url).toBe(`/api/v1/devices/${device_id}`)
		expect(_calls[0]!.method).toBe("PATCH")
	})

	test("sends id and name in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device))
		const { update } = useDeviceMutation()
		await update({ id: device_id, name: "Renamed Phone" })
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.id).toBe(device_id)
		expect(body.name).toBe("Renamed Phone")
	})

	test("returns parsed device from response", async () => {
		const updated = { ...sample_device, name: "Renamed Phone" }
		_fetch_stub = () => Promise.resolve(ok_json(updated))
		const { update } = useDeviceMutation()
		const result = await update({ id: device_id, name: "Renamed Phone" })
		expect(result.name).toBe("Renamed Phone")
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { update } = useDeviceMutation()
		await expect(update({ id: device_id, name: "X" })).rejects.toThrow(/HTTP 404/)
	})

	test("encodes id in path (UUID safe by default)", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_device))
		const { update } = useDeviceMutation()
		await update({ id: device_id })
		// UUID does not change under encodeURIComponent
		expect(_calls[0]!.url).toContain(device_id)
	})
})

// ---------------------------------------------------------------------------
// delete()
// ---------------------------------------------------------------------------

describe("useDeviceMutation().delete", () => {
	test("DELETE to /api/v1/devices/[id]", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const mutation = useDeviceMutation()
		await mutation.delete(device_id)
		expect(_calls[0]!.url).toBe(`/api/v1/devices/${device_id}`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("returns void (undefined) on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const mutation = useDeviceMutation()
		const result = await mutation.delete(device_id)
		expect(result).toBeUndefined()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const mutation = useDeviceMutation()
		await expect(mutation.delete(device_id)).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const mutation = useDeviceMutation()
		await expect(mutation.delete(device_id)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// toggle()
// ---------------------------------------------------------------------------

describe("useDeviceMutation().toggle", () => {
	test("POST to /api/v1/devices/[id]/toggle", async () => {
		const toggled = { ...sample_device, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useDeviceMutation()
		await toggle({ id: device_id, enabled: false })
		expect(_calls[0]!.url).toBe(`/api/v1/devices/${device_id}/toggle`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends enabled in body", async () => {
		const toggled = { ...sample_device, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useDeviceMutation()
		await toggle({ id: device_id, enabled: false })
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.enabled).toBe(false)
	})

	test("returns parsed device from response", async () => {
		const toggled = { ...sample_device, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useDeviceMutation()
		const result = await toggle({ id: device_id, enabled: false })
		expect(result.enabled).toBe(false)
		expect(result.id).toBe(device_id)
	})

	test("toggle to enabled=true", async () => {
		const toggled = { ...sample_device, enabled: true }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useDeviceMutation()
		const result = await toggle({ id: device_id, enabled: true })
		expect(result.enabled).toBe(true)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("server error", { status: 500 }))
		const { toggle } = useDeviceMutation()
		await expect(toggle({ id: device_id, enabled: false })).rejects.toThrow(/HTTP 500/)
	})
})

// ---------------------------------------------------------------------------
// General — api_base propagation
// ---------------------------------------------------------------------------

describe("useDeviceMutation — api_base propagation", () => {
	test("all actions prepend api_base when set", async () => {
		set_api_base("http://10.0.0.1:5173")
		_fetch_stub = (url) => {
			if (url.includes("/toggle")) {
				return Promise.resolve(ok_json(sample_device))
			}
			if (url.endsWith("/devices")) {
				return Promise.resolve(ok_json(sample_device, 201))
			}
			return Promise.resolve(ok_json(sample_device))
		}

		const { create, update, toggle } = useDeviceMutation()
		const mutation = useDeviceMutation()

		_calls.splice(0)
		await create({ slug: "x", name: "X", filter_criteria: { nsfw: "all" } })
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await update({ id: device_id })
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await mutation.delete(device_id)
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		_calls.splice(0)
		await mutation.delete(device_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_fetch_stub = () => Promise.resolve(ok_json(sample_device))
		_calls.splice(0)
		await toggle({ id: device_id, enabled: true })
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)
	})
})
