# 008 — Source: Booru — tasks

## Fixtures

- [ ] `__fixtures__/booru/danbooru-posts.json` — 3 posts, mixed `rating`, one with `file_url: null`
- [ ] `__fixtures__/booru/gelbooru-posts.json` — 3 posts, mixed rating, both `post` and `posts` wrapper variants in separate fixtures if needed

## Module

- [ ] `src/lib/server/sources/booru.ts` exports `slug`, `input_schema`, `crawl`, `register`
- [ ] `BooruInputSchema` matches Decisions, `.strict()`
- [ ] Variant-aware URL builder
- [ ] Tag concatenation per variant
- [ ] NSFW rating → wallrus nsfw mapping
- [ ] Skip null `file_url`
- [ ] Skip `.gif`
- [ ] Pagination loop terminates on empty response
- [ ] `rating: "any"` does not append `rating:` token

## Aggregator

- [ ] `_aggregator.ts` imports + registers Booru

## Unit tests

- [ ] `booru.test.ts` covers:
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

- [ ] `_registry.lookup("booru")` returns the entry post-bootstrap

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(source-booru): danbooru + gelbooru crawler with tag/rating filters`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 008-source-booru done` committed + pushed
