import { describe, expect, test } from "bun:test"
import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import { app_error_to_response } from "./errors"

async function parse_body(res: Response): Promise<unknown> {
	return res.json()
}

describe("app_error_to_response", () => {
	test("not_found.* → 404", async () => {
		const err = AppError.fail("not_found.device", { status: 404 })
		const res = app_error_to_response(err)
		expect(res.status).toBe(404)
		const body = (await parse_body(res)) as { error: { code: string; message: string } }
		expect(body.error.code).toBe("not_found.device")
	})

	test("validation.* → 400", async () => {
		const err = AppError.fail("validation.slug_taken", { status: 400 })
		const res = app_error_to_response(err)
		expect(res.status).toBe(400)
		const body = (await parse_body(res)) as { error: { code: string } }
		expect(body.error.code).toBe("validation.slug_taken")
	})

	test("validation.slug_taken with status 409 → 409", async () => {
		const err = AppError.fail("validation.slug_taken", { status: 409 })
		const res = app_error_to_response(err)
		expect(res.status).toBe(409)
	})

	test("auth.* → 401", async () => {
		const err = AppError.fail("auth.invalid", { status: 401 })
		const res = app_error_to_response(err)
		expect(res.status).toBe(401)
		const body = (await parse_body(res)) as { error: { code: string } }
		expect(body.error.code).toBe("auth.invalid")
	})

	test("unknown code → 500", async () => {
		const err = AppError.fail("internal.whatever", { status: 500 })
		const res = app_error_to_response(err)
		expect(res.status).toBe(500)
	})

	test("non-AppError → 500", async () => {
		const res = app_error_to_response(new Error("boom"))
		expect(res.status).toBe(500)
		const body = (await parse_body(res)) as { error: { error_id?: string } }
		expect(body.error.error_id).toBeDefined()
	})

	test("fields are included when present", async () => {
		const err = AppError.fail("validation.slug_taken", {
			status: 409,
			fields: { slug: "already-taken" },
		})
		const res = app_error_to_response(err)
		const body = (await parse_body(res)) as {
			error: { fields?: Record<string, unknown> }
		}
		expect(body.error.fields).toBeDefined()
		expect(body.error.fields?.slug).toBe("already-taken")
	})

	test("publicMessage is used as the user-facing message", async () => {
		const err = AppError.fail("not_found.device", {
			status: 404,
			publicMessage: "Device not found.",
		})
		const res = app_error_to_response(err)
		const body = (await parse_body(res)) as { error: { message: string } }
		expect(body.error.message).toBe("Device not found.")
	})

	test("500 response includes error_id for correlation", async () => {
		const res = app_error_to_response(new TypeError("unexpected"))
		const body = (await parse_body(res)) as { error: { error_id?: string } }
		expect(body.error.error_id).toMatch(/^err_/)
	})

	test("Content-Type header is application/json", () => {
		const err = AppError.fail("not_found.x", { status: 404 })
		const res = app_error_to_response(err)
		expect(res.headers.get("Content-Type")).toBe("application/json")
	})
})
