import { describe, expect, mock, test } from "bun:test"
import type { RequestEvent } from "@sveltejs/kit"
import { clear_session_cookie, SESSION_COOKIE, set_session_cookie } from "./cookie"

/** Minimal mock of the SvelteKit RequestEvent for cookie tests. */
function make_event(protocol: "http:" | "https:" = "http:") {
	const set_spy = mock(() => {})
	const delete_spy = mock(() => {})
	const event = {
		url: new URL(`${protocol}//localhost/`),
		cookies: {
			set: set_spy,
			delete: delete_spy,
		},
	} as unknown as RequestEvent
	return { event, set_spy, delete_spy }
}

describe("set_session_cookie", () => {
	test("sets expected cookie attributes over http", () => {
		const { event, set_spy } = make_event("http:")
		set_session_cookie(event, "my_token")

		expect(set_spy).toHaveBeenCalledTimes(1)
		const call0 = set_spy.mock.calls[0] as unknown as [string, string, Record<string, unknown>]
		const [name, value, opts] = call0
		expect(name).toBe(SESSION_COOKIE)
		expect(value).toBe("my_token")
		expect(opts.httpOnly).toBe(true)
		expect(opts.sameSite).toBe("lax")
		expect(opts.path).toBe("/")
		expect(opts.maxAge).toBe(2592000) // 30 days
		expect(opts.secure).toBe(false)
	})

	test("sets Secure=true over https", () => {
		const { event, set_spy } = make_event("https:")
		set_session_cookie(event, "my_token")

		const call0 = set_spy.mock.calls[0] as unknown as [string, string, Record<string, unknown>]
		const opts = call0[2]
		expect(opts.secure).toBe(true)
	})
})

describe("clear_session_cookie", () => {
	test("deletes the session cookie with path=/", () => {
		const { event, delete_spy } = make_event("http:")
		clear_session_cookie(event)

		expect(delete_spy).toHaveBeenCalledTimes(1)
		const call0 = delete_spy.mock.calls[0] as unknown as [string, Record<string, unknown>]
		const [name, opts] = call0
		expect(name).toBe(SESSION_COOKIE)
		expect(opts.path).toBe("/")
	})
})
