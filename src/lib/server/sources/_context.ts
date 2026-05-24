import type { SourceContext } from "./_types"

/**
 * Factory for the concrete `SourceContext` implementation wired to
 * `globalThis.fetch`. Used by the runtime (ingest pipeline, slice 009).
 * Tests inject their own stub context instead of using this.
 *
 * @param opts.abort  AbortSignal forwarded to every HTTP call.
 * @param opts.log_prefix  Prefix prepended to every log message (e.g. "source.reddit").
 */
export function make_source_context(opts: {
	abort: AbortSignal
	log: SourceContext["log"]
}): SourceContext {
	const { abort, log } = opts

	async function checked_json(res: Response, url: string): Promise<unknown> {
		const ct = res.headers.get("content-type") ?? ""
		if (!ct.includes("application/json") && !ct.includes("text/json")) {
			const body = await res.text()
			throw new Error(
				`Expected JSON from ${url} but got Content-Type: ${ct}. ` +
					`Status: ${res.status}. Body preview: ${body.slice(0, 200)}`,
			)
		}
		return res.json()
	}

	return {
		log,
		abort,

		async http_get_json(url: string, init?: RequestInit): Promise<unknown> {
			const res = await globalThis.fetch(url, { signal: abort, ...init })
			return checked_json(res, url)
		},

		async http_get_bytes(url: string, init?: RequestInit): Promise<Uint8Array> {
			const res = await globalThis.fetch(url, { signal: abort, ...init })
			const buf = await res.arrayBuffer()
			return new Uint8Array(buf)
		},

		async http_post_form(
			url: string,
			body: Record<string, string>,
			init?: RequestInit,
		): Promise<unknown> {
			const form = new URLSearchParams(body).toString()
			const res = await globalThis.fetch(url, {
				method: "POST",
				signal: abort,
				...init,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					...(init?.headers as Record<string, string> | undefined),
				},
				body: form,
			})
			return checked_json(res, url)
		},
	}
}
