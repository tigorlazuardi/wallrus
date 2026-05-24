# 012 — WebUI: device + subscription editor — tasks

## API endpoint

- [x] `src/routes/api/v1/sources/+server.ts` — GET returns `{ items: [{ slug, description? }] }` from `_registry.list()`
- [x] Route test asserts shape + auth gate

## shadcn-svelte components

- [x] `bunx shadcn-svelte add input select switch slider label checkbox radio-group form textarea` (missing ones only — hand-rolling per reconciliation notes)

## Reusable components

- [x] `src/lib/components/FilterEditor.svelte` — bind to `DeviceFilters` value
- [x] `src/lib/components/CronInput.svelte` — croner-validated, preview "Next 3 runs"
- [x] `src/lib/components/TagsInput.svelte` — chip-style with Enter/Backspace
- [x] `src/lib/components/DeviceSelector.svelte` — multi-select chip list
- [x] `src/lib/components/SubscriptionForm.svelte` — composes the four above (invocation 2)

## Pages

- [x] `src/routes/(app)/devices/+page.svelte` — list with create button
- [x] `src/routes/(app)/devices/new/+page.svelte` + `+page.server.ts` — superform
- [x] `src/routes/(app)/devices/[slug]/+page.svelte` — detail with FilterEditor (live save) + linked subscriptions + per-device gallery
- [x] `src/routes/(app)/devices/[slug]/edit/+page.svelte` + `+page.server.ts`
- [x] `src/routes/(app)/subscriptions/+page.svelte` — list with include_deleted toggle (invocation 2)
- [x] `src/routes/(app)/subscriptions/new/+page.svelte` + `+page.server.ts` (invocation 2)
- [x] `src/routes/(app)/subscriptions/[id]/+page.svelte` + `+page.server.ts` — edit + linked devices toggling (invocation 2)

## Form behavior

- [x] All forms use sveltekit-superforms with Zod adapter (device forms) or direct fetch+server actions (subscription forms with dynamic params) (invocation 2)
- [x] Server actions call services via `runtime_ref().services.<domain>.<op>()` directly — never fetch to own API (invocation 2)
- [x] On success: redirect to detail/list (invocation 2)
- [x] On validation error: render inline messages (invocation 2)

## Component tests

- [x] `FilterEditor.test.ts` — emits expected `DeviceFilters` on input changes
- [x] `CronInput.test.ts` — invalid cron shows error; valid shows next runs
- [x] `TagsInput.test.ts` — Enter adds, Backspace removes
- [x] `DeviceSelector.test.ts` — toggling chip mutates bound array

- [x] `src/lib/components/SubscriptionForm.test.ts` — param descriptor derivation, source change reset, error helpers (invocation 2)

## Playwright

- [-] `tests/e2e/devices.spec.ts` — written but deferred: Playwright webServer doesn't call set_runtime() — same blocker as slice 011's gallery.spec.ts. Defer until a Playwright-bootstrap slice rewires `webServer`. (invocation 2)
- [-] `tests/e2e/subscriptions.spec.ts` — written but deferred: same blocker as above. (invocation 2)

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green
- [-] `bun run test:e2e` green (Playwright blocked, see slice 011 builder notes)
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [-] Manual smoke: full device/subscription lifecycle through UI — deferred to reviewer or follow-up session (requires browser session outside builder scope)
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(webui-device): device + subscription editor pages with superforms-driven flows`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 012-webui-device done` committed + pushed
