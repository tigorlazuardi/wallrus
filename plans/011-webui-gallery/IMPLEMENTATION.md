# 011 — WebUI: gallery

## Status

**done**

## Goal

The main `/` route: a masonry gallery of images with infinite scroll,
NSFW gate, filter chips (device / source / favorite / nsfw),
image-detail modal. Reads `/api/v1/images` from 006. No write actions yet
(favorite + delete UI lands here but the actions are inline buttons
calling existing 006 endpoints).

## Decisions (pre-baked)

- **Route**: `src/routes/(app)/+page.svelte` (the `(app)` group is the
  authenticated shell created here). Sibling `src/routes/(app)/+layout.svelte`
  hosts the top nav.
- **Layout**: CSS Grid masonry per `engineering/ARCHITECTURE.md`:
  - `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` (2 cols
    mobile, 3 tablet, 4 desktop achieved by min size + viewport).
  - `grid-auto-rows: 8px`. Each card sets `grid-row: span <ratio-bucket>`
    based on `image.aspect_ratio`. `--rows` CSS var on each card.
  - `grid-auto-flow: dense` for back-fill.
- **Image card**:
  - Background = thumbnail URL (served by a new endpoint
    `/api/v1/images/[id]/thumbnail` returning the webp from
    `.thumbs/<image_id>.webp` — add it in this slice).
  - Aspect-ratio container = original AR.
  - Overlay on hover: title, source badge, favorite button, delete
    button (calls `DELETE /api/v1/images/[id]?blacklist=false`).
  - NSFW images get blurred preview until clicked, gated by
    user-level `nsfw_revealed` (sessionStorage flag).
- **Filter chips bar**: device, source, NSFW toggle, "favorites only".
  Persists to URL query so deep-linking works.
- **Infinite scroll**: IntersectionObserver on a sentinel row.
- **Image modal**: shadcn-svelte Dialog showing full-resolution image
  (served from a new `/api/v1/images/[id]/file` endpoint streaming the
  blob with `Content-Disposition: inline`).
- **State**: Svelte 5 runes (`$state`, `$derived`, `$effect`). Use a
  small `+page.ts` load function for the initial page; subsequent pages
  fetched client-side.
- **Empty state**: friendly placeholder with a link to "Add a
  subscription" → `/subscriptions/new` (route created later by 012).
- **Loading state**: skeleton shimmer (Tailwind `animate-pulse`).
- **Error state**: inline alert + retry button.

## State at end of slice

- `src/routes/(app)/+layout.svelte` + `+layout.server.ts` (auth check)
- `src/routes/(app)/+page.svelte` + `+page.ts`
- `src/lib/components/{ImageCard,FilterChips,Masonry,ImageModal,NsfwGate}.svelte`
- `src/routes/api/v1/images/[id]/thumbnail/+server.ts`
- `src/routes/api/v1/images/[id]/file/+server.ts`
- shadcn-svelte components added if not present: Dialog, Badge, Button,
  Card, Skeleton, Alert. Run `bunx shadcn-svelte add …` per missing
  component.
- Playwright spec extended for `/` smoke

## Resume here

1. Read `.claude/rules/frontend.md` and `engineering/ARCHITECTURE.md`
   §Frontend.
2. Add the `(app)` route group + auth-redirecting layout. The
   `+layout.server.ts` reads `event.locals.user`; if null and not in
   the (auth)/(public) groups, redirect to `/login`.
3. Add thumbnail + file blob endpoints (read FS via
   `Bun.file(path).stream()`, set `cache-control: private, max-age=31536000, immutable`
   on thumbnails; `no-cache` on full files).
4. Build components in order: `Masonry` (layout primitive),
   `ImageCard`, `FilterChips`, `NsfwGate`, `ImageModal`.
5. Wire `+page.svelte`:
   - Initial fetch in `+page.ts` (SvelteKit `fetch`).
   - Reactive store driving paginated fetch on filter change + scroll.
6. Run shadcn-svelte adds for missing components.
7. Tests:
   - Component tests via `@testing-library/svelte` for `ImageCard`
     (renders, click favorite, click NSFW blur reveal).
   - Playwright e2e `tests/e2e/gallery.spec.ts`: navigate to `/`, expect
     at least one image card (seeded via API in `beforeAll`).
8. Smoke: load `/`, scroll → next page fetched, click image → modal
   opens, click favorite → API request, NSFW image starts blurred.
9. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green (`tests/e2e/gallery.spec.ts`)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual: open `/` in browser, verify masonry layout, filter chips,
      infinite scroll, NSFW blur, modal, favorite toggle
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(webui-gallery): masonry gallery, filter chips, infinite scroll, image modal, NSFW gate
```

Body: route group + layout, components list, new thumbnail/file
endpoints, NSFW session gate, Playwright spec. Co-author. Push. Then
`chore(plans): mark 011-webui-gallery done`.

## Gotchas

- Tailwind v4 reads tokens from `app.css` `@theme`; don't redefine
  `--color-bg` in component scope.
- IntersectionObserver fires once-per-trigger; on filter change, reset
  the observed sentinel by replacing it (key it on the filter signature).
- The full-size file endpoint must check `event.locals.user` (already
  via 003 gate) but should NOT rate-limit (image grids hit it 50 times).
- `Bun.file(path).stream()` returns a `ReadableStream<Uint8Array>` —
  pass directly to `new Response(stream, {…})`.
- Use `<img loading="lazy" decoding="async">` on thumbnails.

## Deferred

- Search box (FTS) wired in UI → 013-webui-runs slice? No — open a
  follow-up `014-webui-polish` for search + tag editor. For 011,
  filter chips are enough.
- Drag-to-reorder, multi-select → post-MVP.
