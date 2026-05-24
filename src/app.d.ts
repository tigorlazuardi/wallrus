// See https://svelte.dev/docs/kit/types#app
declare global {
	namespace App {
		interface Error {
			message: string
			code?: string
		}
		interface Locals {
			// Populated by hooks.server.ts after the auth gate succeeds.
			// `null` when auth is disabled (WALLRUS_AUTH_ENABLE=false).
			user: { username: string } | null
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
