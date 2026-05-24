// See https://svelte.dev/docs/kit/types#app
declare global {
	namespace App {
		interface Error {
			message: string
			code?: string
		}
		interface Locals {
			// Populated by hooks.server.ts after the auth gate succeeds.
			// `null` when the request has no valid credentials and the path is not
			// on the allowlist (hooks will have already returned 401/302 before
			// a route handler fires). Set to a disabled-mode value when
			// WALLRUS_AUTH_ENABLE=false.
			user: { name: string; auth_mode: "jwt" | "basic" | "disabled" } | null
			// Set by hooks.server.ts before every request. Comes from the
			// Runtime singleton established by cli.ts serve after boot().
			// Type is the Drizzle BunSQLite client (has `.run()` for plain SQL).
			db: import("./lib/server/db/client").DbClient
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
