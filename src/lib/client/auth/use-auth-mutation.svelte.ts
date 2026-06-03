/**
 * Auth mutation hook — login.
 *
 * Calls POST /api/v1/auth/login with username + password.
 *
 * - On native (Capacitor): stores the returned access_token in Preferences
 *   under the key "auth_token" so apiFetch can inject it as a Bearer header.
 * - On web: the server already set the httpOnly auth_session cookie;
 *   no Preferences write needed.
 *
 * Returns action functions with no internal reactive state. Callers manage
 * their own loading/error state (consistent with other mutation hooks in this
 * project — see use-device-mutation.svelte.ts for the same pattern).
 */

import { Preferences } from "@capacitor/preferences"
import { LoginResponseSchema } from "$lib/schemas/auth/Login"
import { apiFetch } from "$lib/client/fetcher"
import { isNativePlatform } from "$lib/client/mobile/platform"

export interface AuthMutationActions {
	login(username: string, password: string): Promise<void>
}

export function useAuthMutation(): AuthMutationActions {
	/**
	 * POST /api/v1/auth/login → stores Bearer token on native.
	 *
	 * Throws on non-OK response or parse failure.
	 */
	async function login(username: string, password: string): Promise<void> {
		const res = await apiFetch("/api/v1/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
		})

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
		}

		const data = LoginResponseSchema.parse(await res.json())

		if (isNativePlatform()) {
			await Preferences.set({ key: "auth_token", value: data.access_token })
		}
	}

	return { login }
}
