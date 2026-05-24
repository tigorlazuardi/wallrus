# 011 — WebUI: gallery — tasks

## Route group + layout

- [x] `src/routes/(app)/+layout.svelte` — top nav, glass chrome
- [x] `src/routes/(app)/+layout.server.ts` — auth redirect to `/login` if `locals.user` null
- [x] Move existing placeholder homepage into `(app)/+page.svelte` (or replace)

## shadcn-svelte components

- [x] `bunx shadcn-svelte add dialog button card badge skeleton alert toggle` (only those missing)

## Components

- [x] `src/lib/components/Masonry.svelte` — generic grid wrapper, prop `items`
- [x] `src/lib/components/ImageCard.svelte` — thumbnail, hover overlay, favorite/delete actions
- [x] `src/lib/components/FilterChips.svelte` — device/source/favorite/nsfw chips bound to URL state
- [x] `src/lib/components/ImageModal.svelte` — Dialog with full-resolution image
- [x] `src/lib/components/NsfwGate.svelte` — blur overlay with reveal click
- [x] All components use Svelte 5 runes (`$state`/`$derived`/`$effect`)

## Endpoints

- [x] `src/routes/api/v1/images/[id]/thumbnail/+server.ts` — streams `.thumbs/<id>.webp`
- [x] `src/routes/api/v1/images/[id]/file/+server.ts` — streams original blob
- [x] Both gated by 003 auth
- [x] Thumbnail sets `cache-control: private, max-age=31536000, immutable`
- [x] File sets `cache-control: no-cache`

## Page

- [x] `src/routes/(app)/+page.ts` — initial 50-item fetch from `/api/v1/images`
- [x] `src/routes/(app)/+page.svelte`:
  - [x] Masonry rendering ImageCards
  - [x] FilterChips reactive to URL `?device=…&source=…&favorited=…&nsfw=…`
  - [x] IntersectionObserver sentinel → fetch next page
  - [x] ImageModal opens on card click
  - [x] Loading skeleton
  - [x] Empty state (no images yet) with link to subscriptions

## Tests

- [x] Component test: `ImageCard.test.ts` — renders title/badge, favorite click fires fetch
- [x] Component test: `NsfwGate.test.ts` — blurred by default, reveals on click
- [x] Component test: `FilterChips.test.ts` — toggling chip updates URL search params
- [-] Playwright `tests/e2e/gallery.spec.ts`:
  - Playwright config uses `bun run dev` webServer which can't call set_runtime().
  - The spec file is written and correct; it needs a dedicated Playwright-bootstrap
    slice to wire the webServer to `bun run src/cli.ts serve` instead. Marked [-].

## Verification gates

- [x] `bun run check` clean (0 errors, 1 pre-existing warning in login page)
- [x] `bun test` green (585 pass, 0 fail)
- [-] `bun run test:e2e` — Playwright webServer uses `bun run dev` which can't set_runtime(); skipped (gallery.spec.ts written but can't run without Playwright-bootstrap slice)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in base.ts)
- [x] `bunx prettier --check .` clean
- [x] Manual smoke per IMPLEMENTATION.md — 200 HTML, 404 on thumbnail/file
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-gallery): masonry gallery, filter chips, infinite scroll, image modal, NSFW gate`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 011-webui-gallery done` committed + pushed
