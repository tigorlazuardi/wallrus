import type { RequestEvent } from "@sveltejs/kit"
import { getLogger } from "$lib/server/telemetry"

// Health probe endpoint. Returns 200 "ok" when the DB is reachable, 503
// "db not ready" otherwise. Intentionally unauthenticated — keep it that way
// so Docker HEALTHCHECK and K8s liveness probes can reach it without creds.
// The 003-auth slice must include /healthz in its allowlist.

export async function GET(event: RequestEvent): Promise<Response> {
	try {
		event.locals.db.run("select 1")
		return new Response("ok", {
			status: 200,
			headers: { "content-type": "text/plain" },
		})
	} catch (err) {
		getLogger().error("healthz db ping failed", {
			module: "http",
			error: err instanceof Error ? err.message : String(err),
		})
		return new Response("db not ready", {
			status: 503,
			headers: { "content-type": "text/plain" },
		})
	}
}
