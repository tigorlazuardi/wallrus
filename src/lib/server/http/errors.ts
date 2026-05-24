/**
 * HTTP error response helpers for wallrus API route handlers.
 *
 * Translates `AppError` instances (thrown by services) into typed JSON
 * `Response` objects per the wallrus API error contract:
 *
 *   { error: { code, message, fields? } }
 *
 * Status mapping (driven by the AppError's internal message used as code):
 *   not_found.*  → 404
 *   validation.* → 400
 *   auth.*       → 401
 *   (default)    → 500 (with error_id stub for operator correlation)
 *
 * The `AppError.message` field is used as the machine-readable error code
 * (e.g. "not_found.device"). `AppError.publicMessage` is the user-facing text.
 */
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

type ErrorBody = {
	error: {
		code: string
		message: string
		fields?: Record<string, unknown>
		error_id?: string
	}
}

function status_for_code(code: string, fallback_status: number): number {
	// Explicit status on the error takes precedence
	if (fallback_status > 0 && fallback_status !== 500) return fallback_status
	if (code.startsWith("not_found.")) return 404
	if (code.startsWith("validation.")) return 400
	if (code.startsWith("auth.")) return 401
	return fallback_status > 0 ? fallback_status : 500
}

/**
 * Convert any thrown value into a JSON `Response`.
 *
 * - If `err` is (or wraps) an `AppError`, the code drives the HTTP status and
 *   `publicMessage` drives the user-facing message.
 * - Any other error is wrapped at 500.
 */
export function app_error_to_response(err: unknown): Response {
	const app_err = AppError.is(err, AppError) ?? AppError.wrap(err, { status: 500 })

	// The internal message doubles as the machine-readable code
	const code = app_err.message
	const effective_status = status_for_code(code, app_err.status)

	const body: ErrorBody = {
		error: {
			code,
			message: app_err.publicMessage || "An unexpected error occurred.",
		},
	}

	if (app_err.fields && Object.keys(app_err.fields).length > 0) {
		body.error.fields = app_err.fields
	}

	// For 500s, generate a simple correlation marker from timestamp
	if (effective_status >= 500) {
		body.error.error_id = `err_${Date.now().toString(36)}`
	}

	return new Response(JSON.stringify(body), {
		status: effective_status,
		headers: { "Content-Type": "application/json" },
	})
}
