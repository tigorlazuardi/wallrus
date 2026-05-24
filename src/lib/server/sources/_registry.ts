import type { SourceModule } from "./_types"
import { register_reddit } from "./reddit"

// First-party source registry. Each concrete source (`reddit.ts`,
// `danbooru.ts`, etc.) imports here and gets registered by slug.
// MVP set: reddit, danbooru, gelbooru, safebooru, yandere, konachan —
// added in subsequent commits.
export const sources: Record<string, SourceModule> = {}

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
	// 008 will add: register_danbooru(), register_gelbooru(), …
}
