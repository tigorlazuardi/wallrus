---
paths:
  - "src/lib/server/sources/**"
---

# wallrus — source module rules

First-party source adapters live under `src/lib/server/sources/<slug>.ts`. One file per source. No plugin system. Full design in [`engineering/ARCHITECTURE.md`](../../engineering/ARCHITECTURE.md) §Source contract.

## Module shape

```ts
import { z } from "zod"
import type { SourceModule, SourceItem } from "./_types"

const Params = z.object({
  // …
})

const my_source: SourceModule<z.infer<typeof Params>> = {
  slug: "my-source", // unique, kebab-case
  display_name: "My Source",
  params_schema: Params, // Zod — the contract. Consumed directly by WebUI (Superforms) and services. JSON Schema is an optional export via z.toJSONSchema() only.
  credential: {
    schema: z.object({
      /* … */
    }), // OPTIONAL; only if source supports elevated mode
    description: "OAuth client id + secret",
  },
  async *fetch(ctx, params, credential) {
    // paginate, yield SourceItem
  },
}

export default my_source
```

Register in `_registry.ts`:

```ts
import my_source from "./my-source"
export const sources: Record<string, SourceModule> = { /* … */ "my-source": my_source }
```

## What a source MUST do

1. **Yield items as a structured `SourceItem`** matching the shape declared in `_types.ts` (mirrored in [`engineering/SCOPE.md`](../../engineering/SCOPE.md) §Source item shape). Required fields:
   - `source_id`, `title` (empty string OK), `source_url`, `image_url`, `filename` (globally unique per source item; usually `source_id`), `tags` (array, empty OK), `nsfw` (`sfw` / `nsfw` / `unknown`).
2. **Paginate via the async generator.** The runtime decides when to stop based on `max_items_inspected`. Yield, await the consumer, yield again. Don't materialize everything in memory.
3. **Honor `ctx.abort.aborted`.** Check at loop heads. Stop pagination cleanly on abort (shutdown or run cancellation).
4. **Use `ctx.http_get_json` / `ctx.http_get_bytes`** for network. Never `fetch()` directly. The runtime wires the abort signal, telemetry, and a polite User-Agent into ctx HTTP helpers.
5. **Use `ctx.log(level, msg, kv)`** for diagnostics. Never `console.log`.

## What a source MUST NOT do

- **No filesystem access.** No `Bun.file`, no `node:fs`. The runtime owns disk.
- **No database access.** No `db`, no Drizzle imports. Sources return data; the runtime writes it.
- **No `process.env`.** Credentials arrive via the `credential` parameter (when applicable). The runtime fetches them from `source_credentials`.
- **No global state.** Sources are pure modules — instantiated once at registry time but called fresh per run.
- **No throwing for "no items".** Just return / end the generator. Throw only for unrecoverable errors (auth failure, malformed response). Throws bubble up to the run executor and end the run with `status=failed`, `stop_reason=error`.
- **No retries inside the source.** The runtime handles retry / rate-limit policy (post-MVP). For MVP, surface 429s as thrown errors.

## Source item field rules

| Field               | Rule                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_id`         | Stable identifier from the source. Must be unique within this source for the lifetime of the item.                                                                          |
| `title`             | Source-provided. Empty string if absent — NOT `null`.                                                                                                                       |
| `source_url`        | The permalink the user would visit. Part of dedup key. Stable across crawls.                                                                                                |
| `image_url`         | The URL the daemon downloads from. May differ from `source_url`. May change (CDN rotation OK; dedup uses `source_url` + SHA256).                                            |
| `filename`          | On-disk filename without extension. **Globally unique per source item.** Typically `source_id` or a hash. The runtime appends extension from `format`.                      |
| `width`, `height`   | Optional. If omitted, the runtime probes the downloaded bytes with `sharp`. Provide if cheap to extract from the listing response.                                          |
| `file_size`         | Optional. If omitted, the runtime measures the downloaded bytes.                                                                                                            |
| `format`            | Optional. If omitted, the runtime infers from magic bytes via `sharp`. Provide as `'jpg' \| 'png' \| 'webp' \| 'avif'`.                                                     |
| `tags`              | Array of source-provided tags. Empty array if none.                                                                                                                         |
| `nsfw`              | **Must pick one of `'sfw'` / `'nsfw'` / `'unknown'`.** If the source has no signal, use `'unknown'`.                                                                        |
| `created_at_source` | Optional ISO string. Runtime converts to ms epoch on insert.                                                                                                                |
| `search_text`       | Optional. Free-form prose indexed into FTS5. Plan it to be searchable text — concat of title, tags, author, etc. Empty / omitted = item not reachable via free-text search. |

## Credential handling

- If the source declares `credential`, the runtime passes the validated credential to `fetch(ctx, params, credential)`. The source uses it (e.g. as Bearer token, Basic header, OAuth client_id+secret).
- If the source declares `credential` but no row exists in `source_credentials` for this slug, the runtime passes `credential = undefined`. The source must run in **anonymous mode** — whatever the upstream permits unauthenticated.
- Never log the credential value, even at debug level.

## Authoring checklist

Before merging a new source:

- [ ] `slug` is kebab-case, unique across `_registry.ts`.
- [ ] `params_schema` is a Zod schema with sensible defaults.
- [ ] `fetch` is an `async function*` that yields `SourceItem`.
- [ ] Items have a globally-unique `filename`.
- [ ] `nsfw` is one of the three legal values for every yielded item.
- [ ] `ctx.abort.aborted` is checked at each pagination boundary.
- [ ] All network calls go through `ctx.http_get_*`.
- [ ] No `fs`, no `db`, no `process.env`.
- [ ] Item shape passes `_types.ts` typecheck.
- [ ] Manual test: `bun run cli.ts run-once <subscription>` produces sensible items.

## MVP source set

`reddit`, `danbooru`, `gelbooru`, `safebooru`, `yandere`, `konachan`. Anything else needs scope confirmation against [`engineering/SCOPE.md`](../../engineering/SCOPE.md) first.
