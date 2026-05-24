# 007 — Source: Reddit

## Status

**not-started**

## Goal

Implement the Reddit source module per `.claude/rules/sources.md`:
async generator yielding `SourceItem`s, OAuth via stored credentials,
gallery expansion, deterministic dedup keys. Register in the sources
registry (built in 005).

## Decisions (pre-baked)

- **File**: `src/lib/server/sources/reddit.ts`. One file. No subfolder.
- **`input_params` schema** (`RedditInputSchema`):
  ```ts
  z.object({
    subreddit: z.string().regex(/^[a-zA-Z0-9_]{2,21}$/),
    sort: z.enum(["hot", "new", "top", "rising"]).default("hot"),
    time: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
    limit_per_page: z.number().int().min(1).max(100).default(100),
  }).strict()
  ```
- **Auth**: OAuth client_credentials. Credentials live in
  `source_credentials` row `{ source_slug: "reddit", payload:
{ client_id, client_secret, user_agent } }`. The source asks
  `SourceContext` for credentials at start; if absent, throw
  `AppError("source.credentials_missing", "reddit")` — the executor
  marks the run failed.
- **Endpoints**:
  - Token: `POST https://www.reddit.com/api/v1/access_token` with
    `grant_type=client_credentials`, Basic header
    `base64(client_id:client_secret)`, `User-Agent` from creds.
  - Listing: `GET https://oauth.reddit.com/r/{subreddit}/{sort}.json?limit={n}&after={after}` (+`t={time}` when `sort=top`).
- **Pagination**: follow `after` cursor until exhausted or
  `max_items_inspected` reached (latter enforced by the executor in
  009; the source just yields).
- **Item mapping**: each post → 1 `SourceItem`, except galleries
  (`is_gallery && media_metadata`) which yield multiple
  (`media_metadata` keys ordered by `gallery_data.items[].media_id`).
  Skip non-image posts (`post_hint != "image"` AND not a gallery, OR
  url doesn't end in `.jpg|.jpeg|.png|.webp|.avif`).
- **NSFW**: post `over_18 === true` → `nsfw: "nsfw"`, else `"safe"`
  (Reddit doesn't have an "unknown" state; we don't synthesise one).
- **Tags**: empty array (Reddit doesn't expose post tags).
  `title` carries the searchable text; the ingest pipeline writes
  `search_text` from `title` + `subreddit`.
- **`filename`** (the SourceItem field): `<post_id>` for single posts,
  `<post_id>_<media_id>` for gallery items. The pipeline appends the
  detected extension.
- **Rate limit**: respect `X-Ratelimit-Remaining` header; if `< 5`,
  `await Bun.sleep(parse(X-Ratelimit-Reset) * 1000)`.

## State at end of slice

- `src/lib/server/sources/reddit.ts` exporting:
  - `slug = "reddit"`
  - `input_schema = RedditInputSchema`
  - `crawl(ctx, input): AsyncGenerator<SourceItem>`
  - `register(): void` (idempotent registry insert)
- `src/lib/server/sources/_aggregator.ts` (new) calls
  `reddit.register()` and is invoked by bootstrap. Booru (008) will
  add its line here.
- Fixtures under `src/lib/server/sources/__fixtures__/reddit/` capture a
  real listing JSON (single post + gallery post). Mocking via
  `Bun.fetch` mock helper.
- Unit tests cover: token fetch, single post mapping, gallery
  expansion, non-image skip, NSFW mapping, pagination, missing creds
  throw.

## Resume here

1. Read `.claude/rules/sources.md` (the SourceItem contract).
2. Add fixtures: capture a curl response from `r/wallpapers.json?limit=2`
   (sanitised — drop emails/usernames) and save under
   `src/lib/server/sources/__fixtures__/reddit/listing.json`. Same for
   `__fixtures__/reddit/gallery.json`.
3. Write `reddit.ts`:
   - Export `slug`, `input_schema`.
   - `async function* crawl(ctx, input)`:
     - `creds = await ctx.credentials("reddit")`; throw if null.
     - Fetch token.
     - Loop pages:
       - Fetch listing with current `after`.
       - For each child:
         - If gallery, expand into multiple SourceItems.
         - Else if image post, yield one.
         - Else, skip.
       - Update `after`. Break on null.
     - Respect rate limit headers.
4. `register()` function pushes to `_registry`.
5. `_aggregator.ts` (new) imports all source modules and calls
   `register` on each. Bootstrap imports `_aggregator` once.
6. Tests with mocked `Bun.fetch` (use `mock.module` or a global fetch
   stub returning fixture JSON).
7. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — Reddit-specific cases all covered
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Optional dry-run with real creds (operator-driven, not gated by CI)

## Done definition

```
feat(source-reddit): async-generator crawler with OAuth + gallery expansion
```

Body: input schema, OAuth, listing pagination, gallery handling, NSFW
mapping, fixture-based tests, registry registration. Co-author.
Push. Then `chore(plans): mark 007-source-reddit done`.

## Gotchas

- The source module has **no DB access**, **no FS access**, **no env
  access**. Only `ctx` (credentials lookup + logger + `Bun.fetch`-like
  facade for testability). Enforce this by passing only what's needed
  via `SourceContext` and using `getLogger({ module: "source.reddit" })`
  via `ctx.logger`.
- Reddit's `oauth.reddit.com` host requires the `Authorization: Bearer
…` header on every listing request; the token expires in 1h. If a
  generator runs longer (unlikely), refresh on 401.
- `media_metadata` keys are unordered; use `gallery_data.items[]` order
  to yield deterministic.
- Reddit returns HTML in `error` responses sometimes; assert
  `Content-Type: application/json` before `await res.json()`.

## Deferred

- Saved/comments/multireddit sources → post-MVP.
- OAuth refresh token flow → not needed for client_credentials.
- Per-user crawling → out of scope.
