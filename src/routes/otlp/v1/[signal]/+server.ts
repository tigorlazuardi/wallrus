import type { RequestHandler } from "@sveltejs/kit"
import { env, otel_frontend_posture, parse_otlp_headers } from "$lib/server/env"
import { getLogger } from "$lib/server/telemetry"

// OTLP/HTTP proxy. Forwards browser-emitted OTLP payloads to the configured
// collector (`OTEL_EXPORTER_OTLP_ENDPOINT`) while injecting any server-side
// `OTEL_EXPORTER_OTLP_HEADERS` (typically `Authorization=Bearer …`).
//
// Auth posture is driven by `WALLRUS_OTEL_FRONTEND`:
//   disable                              -> 404 (proxy off)
//   enable + WALLRUS_AUTH_ENABLE=false    -> public (no auth required)
//   enable + WALLRUS_AUTH_ENABLE=true     -> requires auth (matches /api/v1)
//   auth                                  -> requires auth (always)
//
// HTTP-only — gRPC collectors won't proxy through this. The browser-side
// `@tigorhutasuhut/telemetry-js/browser` initSDK already speaks OTLP/HTTP.

const ALLOWED_SIGNALS = new Set(["traces", "metrics", "logs"])
const MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MiB cap per submission

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const e = env()
	const posture = otel_frontend_posture(e)
	const log = getLogger()

	if (!posture.enabled) {
		return new Response("otlp proxy disabled", { status: 404 })
	}

	// Auth gate — hooks.server.ts populates locals.user when authenticated.
	// When auth is required but the request has no user, bounce with 401.
	if (posture.auth_required && !locals.user) {
		return new Response("auth required", { status: 401 })
	}

	const signal = params.signal
	if (!signal || !ALLOWED_SIGNALS.has(signal)) {
		return new Response("unknown signal", { status: 404 })
	}

	const content_length = Number(request.headers.get("content-length") ?? "0")
	if (content_length > MAX_BODY_BYTES) {
		return new Response("payload too large", { status: 413 })
	}

	const body = await request.arrayBuffer()
	if (body.byteLength > MAX_BODY_BYTES) {
		return new Response("payload too large", { status: 413 })
	}

	const upstream = `${e.OTEL_EXPORTER_OTLP_ENDPOINT!.replace(/\/$/, "")}/v1/${signal}`
	const headers = new Headers()
	const ct = request.headers.get("content-type")
	const ce = request.headers.get("content-encoding")
	if (ct) headers.set("content-type", ct)
	if (ce) headers.set("content-encoding", ce)

	// Server-side injected headers (Authorization, x-api-key, …). These stay
	// out of the browser entirely.
	for (const [k, v] of Object.entries(parse_otlp_headers(e.OTEL_EXPORTER_OTLP_HEADERS))) {
		headers.set(k, v)
	}

	try {
		const resp = await fetch(upstream, { method: "POST", headers, body })
		return new Response(resp.body, {
			status: resp.status,
			headers: resp.headers,
		})
	} catch (err) {
		log.error("otlp proxy upstream failed", {
			signal,
			upstream,
			error: err instanceof Error ? err.message : String(err),
		})
		return new Response("upstream unreachable", { status: 502 })
	}
}
