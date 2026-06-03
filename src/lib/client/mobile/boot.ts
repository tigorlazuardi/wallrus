/**
 * Mobile boot logic.
 *
 * Called once at app startup on native (Capacitor) platforms.
 * Reads persisted preferences, sets the runtime API base URL, and
 * checks the self-hosted release manifest for available updates.
 *
 * Returns a BootResult discriminated union:
 *   { route: "/setup" }            — first launch, no api_base configured
 *   { route: "/", update: null }   — configured, no update
 *   { route: "/", update: {...} }  — configured, update available
 *
 * If update.mandatory is true, the caller should show a blocking prompt.
 * If update.mandatory is false, show a dismissible banner.
 */

import { Preferences } from "@capacitor/preferences"
import { set_api_base, api_base } from "$lib/client/config"
import { APP_VERSION } from "./version"

export type BootUpdate = {
	version: string
	mandatory: boolean
	url: string
}

export type BootResult =
	| { route: "/setup" }
	| { route: "/"; update: null }
	| { route: "/"; update: BootUpdate }

/**
 * Compare two semver strings. Returns true if `remote` is strictly newer
 * than `local`. Falls back to simple string inequality for non-semver.
 */
function is_newer(local: string, remote: string): boolean {
	if (!remote || remote === local) return false
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split(".")
			.map((n) => parseInt(n, 10) || 0)
	const [lMaj, lMin, lPat] = parse(local)
	const [rMaj, rMin, rPat] = parse(remote)
	if (rMaj !== lMaj) return (rMaj ?? 0) > (lMaj ?? 0)
	if (rMin !== lMin) return (rMin ?? 0) > (lMin ?? 0)
	return (rPat ?? 0) > (lPat ?? 0)
}

/**
 * Fetch the release manifest from the configured daemon.
 * Returns null on any network/parse error (non-blocking).
 */
async function fetch_release_manifest(): Promise<{
	version: string
	mandatory: boolean
	url: string
} | null> {
	const base = api_base()
	if (!base) return null
	try {
		const res = await fetch(`${base}/api/v1/mobile/release/latest`)
		if (!res.ok) return null
		const data = (await res.json()) as { version?: string; mandatory?: boolean; url?: string }
		if (!data.version) return null
		return {
			version: data.version,
			mandatory: data.mandatory ?? false,
			url: data.url ?? "",
		}
	} catch {
		return null
	}
}

export async function boot(): Promise<BootResult> {
	const { value: storedBase } = await Preferences.get({ key: "api_base" })

	if (!storedBase) {
		return { route: "/setup" }
	}

	set_api_base(storedBase)

	const manifest = await fetch_release_manifest()
	if (manifest && is_newer(APP_VERSION, manifest.version)) {
		return {
			route: "/",
			update: {
				version: manifest.version,
				mandatory: manifest.mandatory,
				url: manifest.url,
			},
		}
	}

	return { route: "/", update: null }
}
