import { json } from "@sveltejs/kit"
import { env, otel_frontend_posture } from "$lib/server/env"

// Public discovery endpoint. Returns enough info for any frontend (the
// SvelteKit WebUI, a future mobile app, an external client) to decide whether
// to attempt browser-side OTel forwarding through the /otlp proxy.
//
// Intentionally UNAUTHENTICATED so an anonymous client can ask "should I bother
// authenticating?" — the payload reveals only enabled/auth flags + the path,
// no secrets.

export const GET = async () => {
	const posture = otel_frontend_posture(env())
	return json({
		enabled: posture.enabled,
		auth_required: posture.auth_required,
		mode: posture.mode,
		endpoint: posture.enabled ? "/otlp" : null,
	})
}
