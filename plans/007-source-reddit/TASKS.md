# 007 — Source: Reddit — tasks

## Fixtures

- [x] `src/lib/server/sources/__fixtures__/reddit/listing.json` — single-image + non-image + over_18 sample
- [x] `src/lib/server/sources/__fixtures__/reddit/gallery.json` — gallery post with `media_metadata` + `gallery_data`
- [x] `__fixtures__/reddit/token.json` — `{ access_token, expires_in: 3600, token_type: "bearer" }`

## Module

- [x] `src/lib/server/sources/reddit.ts` exports `slug`, `input_schema`, `fetch`, `register_reddit`
- [x] `RedditInputSchema` matches Decisions, `.strict()`
- [x] OAuth client_credentials token fetch + Basic auth header
- [x] Listing fetch with `Authorization: Bearer …`, `User-Agent` from creds
- [x] Gallery posts expand into multiple SourceItems in `gallery_data.items[]` order
- [x] Non-image posts skipped
- [x] NSFW: `over_18 === true` → "nsfw", else "sfw" (spec said "safe" — contract requires "sfw")
- [-] Rate-limit header respect (`X-Ratelimit-Remaining`, `X-Ratelimit-Reset`) — deferred; `http_get_json` does not expose headers; see .builder-notes.md §Rate-limit headers deferred
- [x] Throws `AppError("source.credentials_missing", ...)` if creds null
- [x] `register_reddit()` pushes to `_registry` (idempotent)

## Aggregator

- [x] `register_sources()` in `_registry.ts` imports + registers reddit (no separate `_aggregator.ts` — reconciliation note says to extend existing stub)
- [x] Bootstrap (`bootstrap.ts`) already calls `register_sources()` — confirmed, no change needed

## Unit tests

- [x] `reddit.test.ts` — fetch mocked via stub SourceContext (not `mock.module("bun")`)
- [x] Token fetch happy path
- [x] Single-post mapping → one SourceItem with expected fields
- [x] Gallery → N SourceItems in deterministic order
- [x] Non-image post → skipped
- [x] NSFW mapping covered both ways
- [x] Pagination — two pages, breaks on `after === null`
- [x] Missing creds → AppError
- [-] Rate-limit honoured (faked headers, asserts `Bun.sleep` call) — SKIPPED: header-aware HTTP not implemented; see .builder-notes.md
- [x] HTML error response → throws helpful error (token schema parse failure gives AppError not SyntaxError)

## Registry interaction

- [x] After `register_reddit()`, `_registry.get_source("reddit")` returns the entry (test: "register_reddit adds entry accessible via get_source")
- [x] `RedditInputSchema` validates a real-looking input shape (test: "validates a real-looking input")

## Verification gates

- [x] `bun run check` clean (0 errors, 1 pre-existing warning in login/+page.svelte)
- [x] `bun test` green (406 pass, 1 skip, 0 fail — 407 total)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in base.ts)
- [x] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(source-reddit): async-generator crawler with OAuth + gallery expansion`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 007-source-reddit done` committed + pushed
