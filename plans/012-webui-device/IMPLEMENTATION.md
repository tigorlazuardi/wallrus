# 012 — WebUI: device + subscription editor

## Status

**not-started**

## Goal

Device list page, per-device detail page (gallery + filter editor),
subscription form (create/edit). Forms use sveltekit-superforms with
the Zod schemas from 004/005. No new APIs — wires existing endpoints.

## Decisions (pre-baked)

- **Routes**:
  - `/devices` — list
  - `/devices/[slug]` — detail (gallery scoped to this device + filter
    editor + linked subscriptions)
  - `/devices/new` — create form
  - `/devices/[slug]/edit` — edit form
  - `/subscriptions` — list
  - `/subscriptions/new` — create form
  - `/subscriptions/[id]` — edit form + linked devices
- **Form library**: `sveltekit-superforms` with Zod adapter. Each `+page.server.ts`
  uses `superValidate(LoadOrFormDataFromZodSchema)` + `actions.default`
  posts to the corresponding API.
- **Filter editor**: a custom component using shadcn-svelte
  Input/Select/Switch/Slider:
  - Resolution: two paired number inputs (min/max w + h)
  - Aspect: number input + tolerance slider
  - File size: two number inputs (MB units in UI, bytes in payload)
  - Format: checkbox group jpg/png/webp/avif
  - Tags include/exclude: token input (Enter to add, click to remove)
  - NSFW: radio group all / sfw_only / nsfw_only
- **Subscription form**:
  - Source select (registry-aware): GET `/api/v1/sources` (new minor
    endpoint that lists registry entries with their input_schema name).
    Add the endpoint in this slice.
  - Dynamic input form rendered from the selected source's JSON-schema-ish
    Zod (use `zod-to-json-schema` for rendering hints; minimal switch
    on type for MVP).
  - Cron field with `croner` client-side validation preview ("Next 3
    runs: …").
  - Max items inspected (default 300).
  - Device multi-select (chips of all devices, click to toggle link).
- **Source listing endpoint**:
  - `GET /api/v1/sources` → `{ items: [{ slug, description? }] }`. No
    pagination, registry is small.
- **`bunx shadcn-svelte add`**: input, select, switch, slider, label,
  checkbox, radio-group, form (the superforms-friendly form), textarea.
- **Auth**: all pages gated by `(app)` group's layout from 011.

## State at end of slice

- 7 new pages under `src/routes/(app)/`
- New components: `FilterEditor.svelte`, `SubscriptionForm.svelte`,
  `CronInput.svelte`, `TagsInput.svelte`, `DeviceSelector.svelte`
- New endpoint `/api/v1/sources`
- Playwright spec covers create-device + create-subscription happy
  paths

## Resume here

1. Read `.claude/rules/frontend.md` + `.claude/rules/api.md`.
2. New API endpoint `GET /api/v1/sources` — reads from `_registry.list()`.
3. shadcn-svelte adds: see Decisions.
4. Build `FilterEditor` (pure component, value = `DeviceFilters`).
   Bind to a `$state` object in the parent form.
5. Device pages + forms.
6. Build `CronInput` (croner-client validation preview), `TagsInput`,
   `DeviceSelector`.
7. `SubscriptionForm` composing above. Variant: select source first,
   render input fields, then cron + devices.
8. Wire all forms via superforms + Zod schemas from 004/005.
9. Tests:
   - Component test for each new component (render, change events).
   - Playwright e2e: create device, create subscription linked to it,
     verify list.
10. Verification gates → commit + push.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bun run test:e2e` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Manual smoke: create device → create subscription → link to device
      → toggle subscription → soft-delete subscription
- [ ] `lefthook` pre-commit + commit-msg pass

## Done definition

```
feat(webui-device): device + subscription editor pages with superforms-driven flows
```

Body: new pages, FilterEditor + SubscriptionForm + ancillary components,
new `/api/v1/sources` endpoint, Playwright spec. Co-author. Push. Then
`chore(plans): mark 012-webui-device done`.

## Gotchas

- Superforms with Zod adapter requires `import { zodClient } from
"sveltekit-superforms/adapters"` on the client and `zod` adapter
  server-side. Don't mix.
- `croner` runs in the browser fine; the form preview computes
  `new Cron(expr).nextRuns(3)` reactively.
- The dynamic source input form is hand-wired per type for MVP — no
  generic JSON-schema renderer. Switch on `z.string` / `z.number` /
  `z.array` / `z.enum`.
- Soft-deleted subscriptions appear in `/subscriptions` only when
  `?include_deleted=true`. The list page has a toggle.

## Deferred

- Schedule preview chart → post-MVP.
- Bulk device-subscription wiring → post-MVP.
- Source credential editor UI → post-MVP (today operators paste via
  SQL or env).
