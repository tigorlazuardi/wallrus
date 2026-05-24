# 008 — Source: Booru — tasks

## Fixtures

- [x] `__fixtures__/booru/danbooru-posts.json` — 3 posts, mixed `rating`, one with `file_url: null`
- [x] `__fixtures__/booru/gelbooru-posts.json` — 3 posts, mixed rating, both `post` and `posts` wrapper variants in separate fixtures if needed

## Module

- [x] `src/lib/server/sources/booru.ts` exports `slug`, `input_schema`, `crawl`, `register`
- [x] `BooruInputSchema` matches Decisions, `.strict()`
- [x] Variant-aware URL builder
- [x] Tag concatenation per variant
- [x] NSFW rating → wallrus nsfw mapping
- [x] Skip null `file_url`
- [x] Skip `.gif`
- [x] Pagination loop terminates on empty response
- [x] `rating: "any"` does not append `rating:` token

## Aggregator

- [x] `_aggregator.ts` imports + registers Booru

## Unit tests

- [x] `booru.test.ts` covers:
  - Danbooru happy path (3 posts → 2 SourceItems after skip)
  - Gelbooru happy path
  - `rating` filter applied
  - NSFW mapping each rating letter
  - Tag concatenation correctness per variant
  - Pagination breaks on empty
  - 422 / error response → throws
  - Missing creds: requests sent without `Authorization` header (still 200)
  - `.gif` skipped

## Registry interaction

- [x] `_registry.lookup("booru")` returns the entry post-bootstrap

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(source-booru): danbooru + gelbooru crawler with tag/rating filters`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 008-source-booru done` committed + pushed
