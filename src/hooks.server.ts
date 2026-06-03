import type { Handle, ServerInit } from "@sveltejs/kit"
import { boot } from "$lib/server/bootstrap"
import { runtime_ref, set_runtime } from "$lib/server/runtime"
import { authenticate } from "$lib/server/auth"

// Lazy-bootstrap the runtime when this hooks module is loaded outside of
// `cli.ts serve` — most importantly under `bun run dev` (Vite), where no
// CLI entrypoint runs and `set_runtime()` would otherwise never fire.
// Production (`cli.ts serve`) already calls `set_runtime()` after `boot()`,
// so the globalThis guard short-circuits this in that path.
export const init: ServerInit = async () => {
	if (globalThis.__wallrus_runtime__ != null) return
	const runtime = await boot()
	set_runtime(runtime)
}

// Exact-match allowlist — these paths never require authentication.
const EXACT_ALLOWLIST = new Set([
	"/healthz",
	"/api/v1/otel/discover",
	"/login",
	"/api/v1/auth/login",
	"/api/v1/auth/logout",
	"/api/v1/auth/status",
	"/favicon.ico",
	"/favicon.svg",
])

// Prefix allowlist — any path starting with these strings passes through.
const PREFIX_ALLOWLIST = ["/otlp/", "/_app/"]

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = runtime_ref().db

	const pathname = event.url.pathname

	// Check allowlist first — no auth needed for these paths.
	const is_allowed =
		EXACT_ALLOWLIST.has(pathname) || PREFIX_ALLOWLIST.some((p) => pathname.startsWith(p))

	const user = await authenticate(event)
	event.locals.user = user

	if (!is_allowed && !user) {
		// API paths → 401 JSON.
		if (pathname.startsWith("/api/")) {
			return new Response(
				JSON.stringify({
					error: { code: "auth.unauthenticated", message: "Authentication required." },
				}),
				{
					status: 401,
					headers: { "content-type": "application/json" },
				},
			)
		}

		// HTML paths → redirect to /login.
		const accept = event.request.headers.get("accept") ?? ""
		if (accept.includes("text/html")) {
			const next = encodeURIComponent(pathname + event.url.search)
			return new Response(null, {
				status: 302,
				headers: { location: `/login?next=${next}` },
			})
		}

		// Non-HTML, non-API (e.g. direct asset fetch with no Accept header) → 401.
		return new Response(
			JSON.stringify({
				error: { code: "auth.unauthenticated", message: "Authentication required." },
			}),
			{
				status: 401,
				headers: { "content-type": "application/json" },
			},
		)
	}

	return resolve(event)
}
