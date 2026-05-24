import type { SourceModule } from "./_types"

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
 * Aggregator stub — called by bootstrap once at startup to register all
 * first-party sources. Today it is a no-op; slices 007 and 008 will fill it
 * in with concrete `import` + `register(...)` calls.
 */
export function register_sources(): void {
	// 007/008 will add: register(reddit_source), register(danbooru_source), …
}
