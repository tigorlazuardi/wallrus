/**
 * Universal load for /setup.
 *
 * The setup/login screen is native-only: it only makes sense on Capacitor
 * where the user must configure the daemon URL before the app can function.
 *
 * On web (non-native), return 404 so the browser URL does not leak a
 * partially-functional setup screen. Web users log in at /login.
 */

import { error } from "@sveltejs/kit"
import { isNativePlatform } from "$lib/client/mobile/platform"
import type { PageLoad } from "./$types"

export const load: PageLoad = () => {
	if (!isNativePlatform()) {
		error(404, "Not found")
	}

	// Native: return empty props — the component manages its own state.
	return {}
}
