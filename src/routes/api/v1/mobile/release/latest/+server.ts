import type { RequestHandler } from "@sveltejs/kit"
import { json } from "@sveltejs/kit"
import { env } from "$lib/server/env"

/**
 * GET /api/v1/mobile/release/latest
 *
 * Public (un-gated) endpoint. Returns the latest mobile release manifest from
 * env vars so the Capacitor app can check for updates before authenticating.
 *
 * When no release has been published (env vars absent), returns an empty
 * version string — the client treats empty version as "no update available".
 */
export const GET: RequestHandler = () => {
	const e = env()

	const version = e.WALLRUS_MOBILE_RELEASE_VERSION ?? ""
	const sha256 = e.WALLRUS_MOBILE_RELEASE_SHA256 ?? ""
	const url = e.WALLRUS_MOBILE_RELEASE_URL ?? ""
	const mandatory = e.WALLRUS_MOBILE_RELEASE_MANDATORY ?? false

	return json({ version, sha256, url, mandatory })
}
