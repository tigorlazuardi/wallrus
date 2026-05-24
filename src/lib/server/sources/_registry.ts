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
