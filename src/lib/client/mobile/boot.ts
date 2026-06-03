/**
 * Mobile boot logic.
 *
 * Called once at app startup on native (Capacitor) platforms.
 * Reads persisted preferences and sets the runtime API base URL.
 *
 * Returns the route the app should navigate to:
 *   "/setup"  — first launch, no api_base configured yet
 *   "/"       — already configured, proceed to the gallery
 */

import { Preferences } from "@capacitor/preferences"
import { set_api_base } from "$lib/client/config"

export async function boot(): Promise<"/setup" | "/"> {
	const { value: storedBase } = await Preferences.get({ key: "api_base" })

	if (!storedBase) {
		return "/setup"
	}

	set_api_base(storedBase)
	return "/"
}
