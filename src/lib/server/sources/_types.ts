import type { z } from "zod"

export type Nsfw = "sfw" | "nsfw" | "unknown"
export type Format = "jpg" | "png" | "webp" | "avif"

// Items yielded by a source's async generator. See
// `.claude/rules/sources.md` §Source item field rules.
export type SourceItem = {
	source_id: string
	title: string
	source_url: string
	image_url: string
	filename: string
	width?: number
	height?: number
	file_size?: number
	format?: Format
	tags: string[]
	nsfw: Nsfw
	created_at_source?: string // ISO 8601
	search_text?: string
}

// Context injected by the runtime. Sources must NOT touch fs/db/env outside
// of these helpers — see `.claude/rules/sources.md` §What a source MUST NOT do.
export type SourceContext = {
	log: (
		level: "debug" | "info" | "warn" | "error",
		msg: string,
		kv?: Record<string, unknown>,
	) => void
	http_get_json: (url: string, init?: RequestInit) => Promise<unknown>
	http_get_bytes: (url: string, init?: RequestInit) => Promise<Uint8Array>
	/**
	 * POST a form-encoded body and return the parsed JSON response.
	 * Added in slice 007 to support Reddit OAuth client_credentials token
	 * endpoint (POST https://www.reddit.com/api/v1/access_token).
	 * The runtime wires this to globalThis.fetch with Content-Type:
	 * application/x-www-form-urlencoded.
	 */
	http_post_form: (
		url: string,
		body: Record<string, string>,
		init?: RequestInit,
	) => Promise<unknown>
	abort: AbortSignal
}

// Source module shape — registered in `_registry.ts`.
export type SourceModule<Params = unknown, Credential = unknown> = {
	slug: string
	display_name: string
	params_schema: z.ZodType<Params>
	credential?: {
		schema: z.ZodType<Credential>
		description: string
	}
	fetch: (
		ctx: SourceContext,
		params: Params,
		credential?: Credential,
	) => AsyncGenerator<SourceItem, void, void>
}
