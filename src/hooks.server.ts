import type { Handle } from "@sveltejs/kit"

// Skeleton handle. Real auth gate + per-request telemetry span will be wired
// in subsequent commits per `.claude/rules/api.md` §Auth gate.
//
// MVP order of concerns once filled in:
//   1. Wrap the request in a telemetry span.
//   2. If WALLRUS_AUTH_ENABLE=false: short-circuit, populate locals.user=null,
//      let the request through.
//   3. Else: validate Bearer JWT / Basic / cookie credentials; 401 / redirect
//      otherwise; populate locals.user.
//   4. Forward to event.resolve(event).
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null
	return resolve(event)
}
