# 007 — Source: Reddit — tasks

## Fixtures

- [ ] `src/lib/server/sources/__fixtures__/reddit/listing.json` — single-image + non-image + over_18 sample
- [ ] `src/lib/server/sources/__fixtures__/reddit/gallery.json` — gallery post with `media_metadata` + `gallery_data`
- [ ] `__fixtures__/reddit/token.json` — `{ access_token, expires_in: 3600, token_type: "bearer" }`

## Module

- [ ] `src/lib/server/sources/reddit.ts` exports `slug`, `input_schema`, `crawl`, `register`
- [ ] `RedditInputSchema` matches Decisions, `.strict()`
- [ ] OAuth client_credentials token fetch + Basic auth header
- [ ] Listing fetch with `Authorization: Bearer …`, `User-Agent` from creds
- [ ] Gallery posts expand into multiple SourceItems in `gallery_data.items[]` order
- [ ] Non-image posts skipped
- [ ] NSFW: `over_18 === true` → "nsfw", else "safe"
- [ ] Rate-limit header respect (`X-Ratelimit-Remaining`, `X-Ratelimit-Reset`)
- [ ] Throws `AppError("source.credentials_missing", "reddit")` if creds null
- [ ] `register()` pushes to `_registry` (idempotent)

## Aggregator

- [ ] `src/lib/server/sources/_aggregator.ts` imports + registers all sources
- [ ] Bootstrap (`bootstrap.ts`) calls `_aggregator.register_all()` after `initSDK`

## Unit tests

- [ ] `reddit.test.ts` — fetch mocked via `mock.module("bun")` or fetch stub
- [ ] Token fetch happy path
- [ ] Single-post mapping → one SourceItem with expected fields
- [ ] Gallery → N SourceItems in deterministic order
- [ ] Non-image post → skipped
- [ ] NSFW mapping covered both ways
- [ ] Pagination — two pages, breaks on `after === null`
- [ ] Missing creds → AppError
- [ ] Rate-limit honoured (faked headers, asserts `Bun.sleep` call)
- [ ] HTML error response → throws helpful error rather than `await res.json()` SyntaxError

## Registry interaction

- [ ] After bootstrap, `_registry.lookup("reddit")` returns the entry
- [ ] `RedditInputSchema` validates a real-looking input shape

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(source-reddit): async-generator crawler with OAuth + gallery expansion`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 007-source-reddit done` committed + pushed
