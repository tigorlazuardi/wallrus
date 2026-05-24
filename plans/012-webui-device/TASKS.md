# 012 — WebUI: device + subscription editor — tasks

## API endpoint

- [ ] `src/routes/api/v1/sources/+server.ts` — GET returns `{ items: [{ slug, description? }] }` from `_registry.list()`
- [ ] Route test asserts shape + auth gate

## shadcn-svelte components

- [ ] `bunx shadcn-svelte add input select switch slider label checkbox radio-group form textarea` (missing ones only)

## Reusable components

- [ ] `src/lib/components/FilterEditor.svelte` — bind to `DeviceFilters` value
- [ ] `src/lib/components/CronInput.svelte` — croner-validated, preview "Next 3 runs"
- [ ] `src/lib/components/TagsInput.svelte` — chip-style with Enter/Backspace
- [ ] `src/lib/components/DeviceSelector.svelte` — multi-select chip list
- [ ] `src/lib/components/SubscriptionForm.svelte` — composes the four above

## Pages

- [ ] `src/routes/(app)/devices/+page.svelte` — list with create button
- [ ] `src/routes/(app)/devices/new/+page.svelte` + `+page.server.ts` — superform
- [ ] `src/routes/(app)/devices/[slug]/+page.svelte` — detail with FilterEditor (live save) + linked subscriptions + per-device gallery
- [ ] `src/routes/(app)/devices/[slug]/edit/+page.svelte` + `+page.server.ts`
- [ ] `src/routes/(app)/subscriptions/+page.svelte` — list with include_deleted toggle
- [ ] `src/routes/(app)/subscriptions/new/+page.svelte` + `+page.server.ts`
- [ ] `src/routes/(app)/subscriptions/[id]/+page.svelte` + `+page.server.ts` — edit + linked devices toggling

## Form behavior

- [ ] All forms use sveltekit-superforms with Zod adapter
- [ ] Server actions POST to corresponding `/api/v1/...` endpoints
- [ ] On success: redirect to detail/list with toast
- [ ] On validation error: render inline messages

## Component tests

- [ ] `FilterEditor.test.ts` — emits expected `DeviceFilters` on input changes
- [ ] `CronInput.test.ts` — invalid cron shows error; valid shows next runs
- [ ] `TagsInput.test.ts` — Enter adds, Backspace removes
- [ ] `DeviceSelector.test.ts` — toggling chip mutates bound array

## Playwright

- [ ] `tests/e2e/devices.spec.ts` — create device + edit filters + soft-delete via UI
- [ ] `tests/e2e/subscriptions.spec.ts` — create subscription, link device, toggle, soft-delete

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke: full device/subscription lifecycle through UI
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-device): device + subscription editor pages with superforms-driven flows`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 012-webui-device done` committed + pushed
