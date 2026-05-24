import { describe, test, expect } from "bun:test"
import { GET } from "../../routes/healthz/+server"
import type { RequestEvent } from "@sveltejs/kit"

// Minimal RequestEvent stub — healthz only needs event.locals.db.run().
function make_event(db_stub: { run: (sql: string) => void }): RequestEvent {
	return {
		locals: { db: db_stub } as unknown as RequestEvent["locals"],
	} as unknown as RequestEvent
}

describe("GET /healthz", () => {
	test("returns 200 ok when db.run succeeds", async () => {
		const event = make_event({ run: () => {} })
		const res = await GET(event)
		expect(res.status).toBe(200)
		expect(await res.text()).toBe("ok")
		expect(res.headers.get("content-type")).toBe("text/plain")
	})

	test("returns 503 db not ready when db.run throws", async () => {
		const event = make_event({
			run: () => {
				throw new Error("nope")
			},
		})
		const res = await GET(event)
		expect(res.status).toBe(503)
		expect(await res.text()).toBe("db not ready")
	})
})
