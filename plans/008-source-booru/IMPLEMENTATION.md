# 008 — Source: Booru (danbooru + gelbooru)

## Status

**done**

## Goal

Implement the Booru source module supporting the two MVP variants:
**danbooru** and **gelbooru**. Async generator yielding `SourceItem`s
with tag → tag mapping (booru's native concept), NSFW rating mapping,
and unified pagination across the two API shapes.

## Decisions (pre-baked)

- **File**: `src/lib/server/sources/booru.ts` — single file handling both
  variants via a `variant` discriminator inside `input_params`.
- **`input_params` schema** (`BooruInputSchema`):
  ```ts
  z.object({
    variant: z.enum(["danbooru", "gelbooru"]),
    host: z.string().url(),
    tags: z.array(z.string()).min(0).max(10),
    limit_per_page: z.number().int().min(1).max(100).default(50),
    rating: z.enum(["s", "q", "e", "any"]).default("any"),
  }).strict()
  ```
  `host` lets the operator point at a specific Danbooru or Gelbooru
  instance (`https://danbooru.donmai.us`, `https://gelbooru.com`, or a
  mirror).
- **Credentials**: optional. `source_credentials` row with payload
  `{ login, api_key }` (danbooru) or `{ user_id, api_key }` (gelbooru).
  If absent, calls go unauthenticated (rate-limited by host).
- **Endpoints**:
  - Danbooru: `GET {host}/posts.json?tags={tags}&limit={n}&page={p}`
    (cursor = increment `page`).
  - Gelbooru: `GET {host}/index.php?page=dapi&s=post&q=index&json=1&tags={tags}&limit={n}&pid={p}`
    (cursor = `pid`, zero-indexed).
- **Item mapping**:
  - `image_url` = `file_url` (danbooru) or `file_url` (gelbooru).
  - `width`, `height`, `file_size`, `format` from the post object.
  - `tags`: danbooru concatenates four categories
    (`tag_string_general` + `tag_string_character` + `tag_string_copyright`
    - `tag_string_artist`); gelbooru splits `tags` (space-separated).
      Result: `string[]` lower-cased, deduped.
  - `filename` = `<post_id>` (no extension, pipeline appends).
  - `created_at_source` = ISO parsed to `unixepoch * 1000`.
  - `source_url` = `<host>/posts/<id>` (danbooru) or
    `<host>/index.php?page=post&s=view&id=<id>` (gelbooru).
- **NSFW mapping**: danbooru rating → wallrus nsfw:
  - `s` (safe) → `safe`
  - `q` (questionable) → `nsfw`
  - `e` (explicit) → `nsfw`
  - `g` (general, newer danbooru) → `safe`
  - Gelbooru ratings are same letters.
- **`rating` filter**: when set, append `rating:{letter}` to the
  `tags` query for danbooru; for gelbooru same (their API accepts
  `rating:safe|questionable|explicit`).
- **Skip non-image**: must have `file_url` ending in
  `.jpg|.jpeg|.png|.webp|.avif|.gif`. GIFs are kept (Wallpaper use will
  static-frame them; but in MVP keep simple: skip GIFs to avoid
  thumbnail headaches). Decision: **skip `.gif`** in this slice.

## State at end of slice

- `src/lib/server/sources/booru.ts` exporting `slug`, `input_schema`,
  `crawl`, `register`.
- `slug = "booru"` (single registered slug; variant is in input_params).
- Fixtures: `__fixtures__/booru/danbooru-posts.json`,
  `__fixtures__/booru/gelbooru-posts.json`.
- Aggregator updated to register Booru.
- Tests cover both variants, both rating filters, missing creds, skip
  non-image.

## Resume here

1. Read `.claude/rules/sources.md`.
2. Capture fixtures from a public danbooru/gelbooru posts.json endpoint
   (sanitise). 2-3 posts each, mixed ratings + at least one non-image.
3. Implement `booru.ts`:
   - Build query per variant.
   - Pagination loop until response empty.
   - Map posts to SourceItems.
   - Skip non-image / .gif.
4. `register()` + aggregator update.
5. Tests with mocked fetch.
6. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — both variants tested
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(source-booru): danbooru + gelbooru crawler with tag/rating filters
```

Body: variant discriminator, tag mapping, NSFW rating mapping, host
override, fixture tests. Co-author. Push. Then
`chore(plans): mark 008-source-booru done`.

## Gotchas

- Gelbooru's JSON wraps posts in `{ post: [...] }` (note: legacy shape
  has `posts: [...]`). Use whichever the live host returns; check both
  in tests.
- Danbooru's free tier limits tags to 2 per query for anonymous users;
  the Zod limit (`max(10)`) is for the schema, but the host will 422 if
  you supply more without auth. Surface that error via the existing
  error path; don't try to be smart.
- Some posts have `file_url` null when deleted-but-still-listed. Skip
  those (no error).
- `rating:any` means "don't filter" — don't add the `rating:` token.

## Deferred

- Other booru variants (e621, safebooru) → post-MVP.
- Pool / favorites endpoints → post-MVP.
- Login flow → not needed (api_key suffices).
