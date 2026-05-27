/**
 * Unit tests for $lib/client/subscriptions/use-subscription-mutation.svelte.ts
 *
 * The mutation hook has no internal $state — it is a plain function that
 * returns action functions. We test each action (create, update, delete,
 * toggle, linkDevice, unlinkDevice) by stubbing globalThis.fetch and verifying:
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

import { useSubscriptionMutation } from "$lib/client/subscriptions/use-subscription-mutation.svelte"

// ---------------------------------------------------------------------------
// Sample data fixtures
// ---------------------------------------------------------------------------

const subscription_id = "018f7e1a-1234-7000-8000-000000000010"
const device_id = "018f7e1a-1234-7000-8000-000000000001"

const sample_subscription = {
	id: subscription_id,
	source_slug: "reddit",
	name: "Wallpapers",
	input_params: { subreddit: "wallpapers" },
	cron: "0 * * * *",
	enabled: true,
	max_items_inspected: null,
	created_at: 1_700_000_000_000,
	deleted_at: null,
}

const sample_link = {
	subscription_id,
	device_id,
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

describe("useSubscriptionMutation().create", () => {
	test("POST to /api/v1/subscriptions", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription, 201))
		const { create } = useSubscriptionMutation()
		await create({
			source_slug: "reddit",
			name: "Wallpapers",
			input_params: { subreddit: "wallpapers" },
			cron: "0 * * * *",
		})
		expect(_calls[0]!.url).toBe("/api/v1/subscriptions")
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends source_slug, name, cron in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription, 201))
		const { create } = useSubscriptionMutation()
		await create({
			source_slug: "reddit",
			name: "Wallpapers",
			input_params: {},
			cron: "0 * * * *",
		})
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.source_slug).toBe("reddit")
		expect(body.name).toBe("Wallpapers")
		expect(body.cron).toBe("0 * * * *")
	})

	test("returns parsed subscription from response", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription, 201))
		const { create } = useSubscriptionMutation()
		const result = await create({
			source_slug: "reddit",
			name: "Wallpapers",
			input_params: {},
			cron: "0 * * * *",
		})
		expect(result.id).toBe(subscription_id)
		expect(result.source_slug).toBe("reddit")
		expect(result.enabled).toBe(true)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("bad request", { status: 400 }))
		const { create } = useSubscriptionMutation()
		await expect(
			create({
				source_slug: "reddit",
				name: "Wallpapers",
				input_params: {},
				cron: "0 * * * *",
			}),
		).rejects.toThrow(/HTTP 400/)
	})

	test("prepends api_base when set", async () => {
		set_api_base("http://192.168.1.100:5173")
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription, 201))
		const { create } = useSubscriptionMutation()
		await create({
			source_slug: "reddit",
			name: "Wallpapers",
			input_params: {},
			cron: "0 * * * *",
		})
		expect(_calls[0]!.url).toBe("http://192.168.1.100:5173/api/v1/subscriptions")
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { create } = useSubscriptionMutation()
		await expect(
			create({ source_slug: "reddit", name: "X", input_params: {}, cron: "0 * * * *" }),
		).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation().update", () => {
	test("PATCH to /api/v1/subscriptions/[id]", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription))
		const { update } = useSubscriptionMutation()
		await update({ id: subscription_id, name: "Renamed Wallpapers" })
		expect(_calls[0]!.url).toBe(`/api/v1/subscriptions/${subscription_id}`)
		expect(_calls[0]!.method).toBe("PATCH")
	})

	test("sends id and name in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription))
		const { update } = useSubscriptionMutation()
		await update({ id: subscription_id, name: "Renamed Wallpapers" })
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.id).toBe(subscription_id)
		expect(body.name).toBe("Renamed Wallpapers")
	})

	test("returns parsed subscription from response", async () => {
		const updated = { ...sample_subscription, name: "Renamed Wallpapers" }
		_fetch_stub = () => Promise.resolve(ok_json(updated))
		const { update } = useSubscriptionMutation()
		const result = await update({ id: subscription_id, name: "Renamed Wallpapers" })
		expect(result.name).toBe("Renamed Wallpapers")
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { update } = useSubscriptionMutation()
		await expect(update({ id: subscription_id, name: "X" })).rejects.toThrow(/HTTP 404/)
	})

	test("encodes id in path (UUID safe by default)", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription))
		const { update } = useSubscriptionMutation()
		await update({ id: subscription_id })
		// UUID does not change under encodeURIComponent
		expect(_calls[0]!.url).toContain(subscription_id)
	})
})

// ---------------------------------------------------------------------------
// delete()
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation().delete", () => {
	test("DELETE to /api/v1/subscriptions/[id]", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const mutation = useSubscriptionMutation()
		await mutation.delete(subscription_id)
		expect(_calls[0]!.url).toBe(`/api/v1/subscriptions/${subscription_id}`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("returns void (undefined) on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const mutation = useSubscriptionMutation()
		const result = await mutation.delete(subscription_id)
		expect(result).toBeUndefined()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const mutation = useSubscriptionMutation()
		await expect(mutation.delete(subscription_id)).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const mutation = useSubscriptionMutation()
		await expect(mutation.delete(subscription_id)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// toggle()
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation().toggle", () => {
	test("POST to /api/v1/subscriptions/[id]/toggle", async () => {
		const toggled = { ...sample_subscription, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useSubscriptionMutation()
		await toggle({ id: subscription_id, enabled: false })
		expect(_calls[0]!.url).toBe(`/api/v1/subscriptions/${subscription_id}/toggle`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends enabled in body", async () => {
		const toggled = { ...sample_subscription, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useSubscriptionMutation()
		await toggle({ id: subscription_id, enabled: false })
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.enabled).toBe(false)
	})

	test("returns parsed subscription from response", async () => {
		const toggled = { ...sample_subscription, enabled: false }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useSubscriptionMutation()
		const result = await toggle({ id: subscription_id, enabled: false })
		expect(result.enabled).toBe(false)
		expect(result.id).toBe(subscription_id)
	})

	test("toggle to enabled=true", async () => {
		const toggled = { ...sample_subscription, enabled: true }
		_fetch_stub = () => Promise.resolve(ok_json(toggled))
		const { toggle } = useSubscriptionMutation()
		const result = await toggle({ id: subscription_id, enabled: true })
		expect(result.enabled).toBe(true)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("server error", { status: 500 }))
		const { toggle } = useSubscriptionMutation()
		await expect(toggle({ id: subscription_id, enabled: false })).rejects.toThrow(/HTTP 500/)
	})
})

// ---------------------------------------------------------------------------
// linkDevice()
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation().linkDevice", () => {
	test("POST to /api/v1/subscriptions/[id]/devices", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_link, 201))
		const { linkDevice } = useSubscriptionMutation()
		await linkDevice(subscription_id, device_id)
		expect(_calls[0]!.url).toBe(`/api/v1/subscriptions/${subscription_id}/devices`)
		expect(_calls[0]!.method).toBe("POST")
	})

	test("sends device_id in body", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_link, 201))
		const { linkDevice } = useSubscriptionMutation()
		await linkDevice(subscription_id, device_id)
		const body = _calls[0]!.body as Record<string, unknown>
		expect(body.device_id).toBe(device_id)
	})

	test("returns parsed link from response", async () => {
		_fetch_stub = () => Promise.resolve(ok_json(sample_link, 201))
		const { linkDevice } = useSubscriptionMutation()
		const result = await linkDevice(subscription_id, device_id)
		expect(result.subscription_id).toBe(subscription_id)
		expect(result.device_id).toBe(device_id)
		expect(result.created_at).toBe(1_700_000_000_000)
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("conflict", { status: 409 }))
		const { linkDevice } = useSubscriptionMutation()
		await expect(linkDevice(subscription_id, device_id)).rejects.toThrow(/HTTP 409/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { linkDevice } = useSubscriptionMutation()
		await expect(linkDevice(subscription_id, device_id)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// unlinkDevice()
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation().unlinkDevice", () => {
	test("DELETE to /api/v1/subscriptions/[id]/devices/[device_id]", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { unlinkDevice } = useSubscriptionMutation()
		await unlinkDevice(subscription_id, device_id)
		expect(_calls[0]!.url).toBe(`/api/v1/subscriptions/${subscription_id}/devices/${device_id}`)
		expect(_calls[0]!.method).toBe("DELETE")
	})

	test("returns void (undefined) on 204", async () => {
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		const { unlinkDevice } = useSubscriptionMutation()
		const result = await unlinkDevice(subscription_id, device_id)
		expect(result).toBeUndefined()
	})

	test("throws on non-OK response", async () => {
		_fetch_stub = () => Promise.resolve(new Response("not found", { status: 404 }))
		const { unlinkDevice } = useSubscriptionMutation()
		await expect(unlinkDevice(subscription_id, device_id)).rejects.toThrow(/HTTP 404/)
	})

	test("propagates network errors", async () => {
		_fetch_stub = () => Promise.reject(new Error("network failure"))
		const { unlinkDevice } = useSubscriptionMutation()
		await expect(unlinkDevice(subscription_id, device_id)).rejects.toThrow("network failure")
	})
})

// ---------------------------------------------------------------------------
// General — api_base propagation
// ---------------------------------------------------------------------------

describe("useSubscriptionMutation — api_base propagation", () => {
	test("all actions prepend api_base when set", async () => {
		set_api_base("http://10.0.0.1:5173")
		_fetch_stub = (url) => {
			if (url.includes("/toggle")) return Promise.resolve(ok_json(sample_subscription))
			if (url.includes("/devices/") && url.includes(device_id))
				return Promise.resolve(new Response(null, { status: 204 }))
			if (url.includes("/devices")) return Promise.resolve(ok_json(sample_link, 201))
			if (url.endsWith("/subscriptions"))
				return Promise.resolve(ok_json(sample_subscription, 201))
			return Promise.resolve(ok_json(sample_subscription))
		}

		const mutation = useSubscriptionMutation()

		_calls.splice(0)
		await mutation.create({
			source_slug: "reddit",
			name: "X",
			input_params: {},
			cron: "0 * * * *",
		})
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		await mutation.update({ id: subscription_id })
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		await mutation.delete(subscription_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		_fetch_stub = () => Promise.resolve(ok_json(sample_subscription))
		await mutation.toggle({ id: subscription_id, enabled: true })
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		_fetch_stub = () => Promise.resolve(ok_json(sample_link, 201))
		await mutation.linkDevice(subscription_id, device_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)

		_calls.splice(0)
		_fetch_stub = () => Promise.resolve(new Response(null, { status: 204 }))
		await mutation.unlinkDevice(subscription_id, device_id)
		expect(_calls[0]!.url.startsWith("http://10.0.0.1:5173")).toBe(true)
	})
})
