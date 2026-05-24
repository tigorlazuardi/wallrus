import { AppError } from "@tigorhutasuhut/telemetry-js/error"
import type { Runtime } from "./bootstrap"

// Module-level singleton stored on `globalThis` so the same instance is
// shared between `cli.ts` (loaded from source) and the SvelteKit build
// output (which has its own compiled copy of this module). Without globalThis,
// `set_runtime()` in cli.ts would set the source-module singleton, but the
// built hooks.server.ts would consult a different compiled-module singleton
// and see `null`.
//
// Assigned exactly once by `cli.ts serve` after `boot()` returns. Callers
// (hooks.server.ts, etc.) use `runtime_ref()` which throws before assignment
// rather than silently returning `undefined`.
//
// See `plans/002-http-integration/IMPLEMENTATION.md` §Decisions and step 5.

declare global {
	var __wallrus_runtime__: Runtime | null
}

if (!("__wallrus_runtime__" in globalThis)) {
	globalThis.__wallrus_runtime__ = null
}

/**
 * Store the Runtime instance produced by `boot()`. Must be called exactly
 * once, before any code that depends on `runtime_ref()` runs.
 */
export function set_runtime(r: Runtime): void {
	globalThis.__wallrus_runtime__ = r
}

/**
 * Return the Runtime singleton. Throws `AppError("runtime.not_initialized")`
 * if `set_runtime` has not yet been called — prevents silent `undefined`
 * propagation when hooks run before CLI wiring.
 */
export function runtime_ref(): Runtime {
	if (globalThis.__wallrus_runtime__ === null) {
		throw new AppError({
			message:
				"runtime_ref() called before set_runtime() — ensure cli.ts calls set_runtime after boot()",
			publicMessage: "Server not ready",
			status: 503,
		})
	}
	return globalThis.__wallrus_runtime__
}

// Exposed only for tests — resets the singleton between test cases.
export function _reset_runtime_for_tests(): void {
	globalThis.__wallrus_runtime__ = null
}
