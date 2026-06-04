import type { SourceModule } from "./_types"
import { register_reddit } from "./reddit"
import { register_booru } from "./booru"

// First-party source registry. Each concrete source (`reddit.ts`,
// `danbooru.ts`, etc.) imports here and gets registered by slug.
// MVP set: reddit, danbooru, gelbooru, safebooru, yandere, konachan —
// added in subsequent commits.
//
// Stored on `globalThis` so the registry is shared between the cli.ts source
// module graph (which runs `register_sources()` at boot) and the bundled
// SvelteKit build graph (API routes / hooks), which compiles its own copy of
// this module. Without this the API's registry is a separate empty object and
// `/api/v1/sources` (plus subscription-create source validation) sees no
// sources. Mirrors the same globalThis pattern in `runtime.ts`.
declare global {
	var __wallrus_sources__: Record<string, SourceModule> | undefined
}

export const sources: Record<string, SourceModule> = (globalThis.__wallrus_sources__ ??= {})

export function get_source(slug: string): SourceModule | undefined {
	return sources[slug]
}

export function list_sources(): SourceModule[] {
	return Object.values(sources)
}

/**
 * Register a source module by its slug. Used by source files (007/008) and
 * tests to seed the registry.
 */
export function register(entry: SourceModule): void {
	sources[entry.slug] = entry
}

/**
 * Aggregator — called by bootstrap once at startup to register all
 * first-party sources. Slice 007 added Reddit; 008 will add Booru sources.
 */
export function register_sources(): void {
	register_reddit()
	register_booru()
}
