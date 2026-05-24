# 011 — WebUI: gallery — tasks

## Route group + layout

- [ ] `src/routes/(app)/+layout.svelte` — top nav, glass chrome
- [ ] `src/routes/(app)/+layout.server.ts` — auth redirect to `/login` if `locals.user` null
- [ ] Move existing placeholder homepage into `(app)/+page.svelte` (or replace)

## shadcn-svelte components

- [ ] `bunx shadcn-svelte add dialog button card badge skeleton alert toggle` (only those missing)

## Components

- [ ] `src/lib/components/Masonry.svelte` — generic grid wrapper, prop `items`
- [ ] `src/lib/components/ImageCard.svelte` — thumbnail, hover overlay, favorite/delete actions
- [ ] `src/lib/components/FilterChips.svelte` — device/source/favorite/nsfw chips bound to URL state
- [ ] `src/lib/components/ImageModal.svelte` — Dialog with full-resolution image
- [ ] `src/lib/components/NsfwGate.svelte` — blur overlay with reveal click
- [ ] All components use Svelte 5 runes (`$state`/`$derived`/`$effect`)

## Endpoints

- [ ] `src/routes/api/v1/images/[id]/thumbnail/+server.ts` — streams `.thumbs/<id>.webp`
- [ ] `src/routes/api/v1/images/[id]/file/+server.ts` — streams original blob
- [ ] Both gated by 003 auth
- [ ] Thumbnail sets `cache-control: private, max-age=31536000, immutable`
- [ ] File sets `cache-control: no-cache`

## Page

- [ ] `src/routes/(app)/+page.ts` — initial 50-item fetch from `/api/v1/images`
- [ ] `src/routes/(app)/+page.svelte`:
  - [ ] Masonry rendering ImageCards
  - [ ] FilterChips reactive to URL `?device=…&source=…&favorited=…&nsfw=…`
  - [ ] IntersectionObserver sentinel → fetch next page
  - [ ] ImageModal opens on card click
  - [ ] Loading skeleton
  - [ ] Empty state (no images yet) with link to subscriptions

## Tests

- [ ] Component test: `ImageCard.test.ts` — renders title/badge, favorite click fires fetch
- [ ] Component test: `NsfwGate.test.ts` — blurred by default, reveals on click
- [ ] Component test: `FilterChips.test.ts` — toggling chip updates URL search params
- [ ] Playwright `tests/e2e/gallery.spec.ts`:
  - Seed via API in `beforeAll` (Basic auth)
  - Visit `/`, expect images
  - Scroll → next page appears
  - Open modal → image visible
  - NSFW image blurred until reveal

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke per IMPLEMENTATION.md
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-gallery): masonry gallery, filter chips, infinite scroll, image modal, NSFW gate`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 011-webui-gallery done` committed + pushed
