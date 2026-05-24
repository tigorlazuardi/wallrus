---
paths:
  - "src/routes/**"
  - "src/lib/components/**"
  - "src/lib/stores/**"
  - "src/lib/client/**"
  - "**/*.svelte"
  - "src/app.html"
  - "src/app.d.ts"
  - "tailwind.config.*"
  - "postcss.config.*"
  - "svelte.config.*"
  - "vite.config.*"
---

# wallrus — frontend rules

Full detail in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §Frontend. This rule restates the enforceable conventions.

## Stack

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`). No legacy stores syntax (`writable`/`readable`) unless wrapping `localStorage`.
- **SvelteKit** adapter: `svelte-adapter-bun`.
- **Tailwind CSS v4** (CSS-first config, oxide engine, no `postcss.config`).
- **shadcn-svelte** primitives — components live in `src/lib/components/ui/*` as copy-paste source. Backed by **Bits UI**.
- Icons: **lucide-svelte** only.
- Forms: **`sveltekit-superforms`** with the `zod` adapter. `dataType: 'json'` mode for nested data. See _Forms — Superforms_ below.

## Component organization

```
src/lib/components/
  ui/                         # shadcn-svelte primitives (button, input, dialog, ...)
  gallery/
    ImageGrid.svelte          # CSS Grid + dense, breakpoint-aware
    ImageCard.svelte          # NSFW blur, favorite overlay
    ImageDetail.svelte        # /images/[id] page content
    FilterBar.svelte          # URL-driven chips
  forms/
    ZodForm.svelte            # generic Zod-driven form
    Field.svelte
  devices/  subscriptions/  runs/  nav/
src/lib/stores/               # localStorage-backed only
src/lib/client/
  sse.ts                      # typed EventSource wrapper
  fetcher.ts                  # /api/v1/* fetch wrapper
```

## Data flow

- **Server `load()` and form actions call services directly** — never `fetch` to your own `/api/v1/*` from server code. Direct service call is faster, type-safe, and bypasses auth re-checks.
- **Mutations** end with `invalidate('app:images')` (or `invalidateAll()`) so dependent `load()` reruns. No tanstack-query.
- **Client UI state** uses `$state` runes inline. Shared cross-route state goes into `src/lib/stores/` only when justified.
- **Persisted client prefs** (theme, NSFW reveal, gallery density): tiny `localStorage`-backed stores.

## Theme

**Archetype: dark-first minimal + glass chrome.** Wallpapers are the hero — gallery stays borderless and minimal so it doesn't compete with image content. Glass effects (`backdrop-filter: blur(20px) saturate(180%)`) are reserved for chrome surfaces.

### Tokens (dark default)

```css
:root[data-theme="dark"] {
  --bg: #0a0a0c;
  --bg-elev: #131316;
  --surface: rgb(255 255 255 / 0.04);
  --surface-hi: rgb(255 255 255 / 0.08);
  --glass: rgb(20 20 24 / 0.55);
  --glass-border: rgb(255 255 255 / 0.08);
  --fg: #e8e8ec;
  --fg-muted: #9a9aa3;
  --accent: #7c5cff; /* violet — DO NOT introduce a second accent */
  --accent-fg: #f3f0ff;
  --ring: rgb(124 92 255 / 0.4);
  --radius: 10px;
  --radius-card: 12px;
  --blur: 20px;
}
```

Light-mode tokens flip surfaces/glass to white-translucent equivalents. Accent stays `#7c5cff`.

### Glass usage rules

- **Only on chrome surfaces**: `TopBar`, `Dialog`, `Sheet/Drawer`, `Popover`, `Tooltip`, `DropdownMenu`, `CommandPalette`.
- **Never on gallery cards or image content backgrounds.** backdrop-filter perf + visual competition with wallpapers.
- Pair glass with a thin `--glass-border` so edge stays legible against varied wallpapers.
- Honor `prefers-reduced-transparency` — fall back to solid `--bg-elev`.

### Typography

- UI / body: **Inter** variable (self-hosted, no Google Fonts fetch).
- Numeric / mono: **Geist Mono** or **JetBrains Mono**.
- No more than two font families ship.

### Theme toggle

- `:root[data-theme="dark|light"]` set at layout mount from `localStorage` → `prefers-color-scheme` fallback. Default `dark`.
- Top-bar toggle persists choice in `localStorage`.

## Gallery rendering

**Layout: aspect-aware CSS-Grid masonry with `grid-auto-flow: dense`.** Pinterest-style with landscape images spanning 2 columns.

| Viewport              | `--cols` | Landscape (`aspect_ratio > 1.2`)    | Portrait |
| --------------------- | -------- | ----------------------------------- | -------- |
| Mobile (`< 640px`)    | 2        | `grid-column: span 2` (fills width) | `span 1` |
| Tablet (`640–1023px`) | 3        | `span 2`                            | `span 1` |
| Desktop (`≥ 1024px`)  | 4        | `span 2`                            | `span 1` |

- `grid-template-columns: repeat(var(--cols), 1fr)`, `grid-auto-rows: 8px` (or similar small base unit).
- Per-card `grid-row: span N` calculated from rendered card height (`column_width × aspect_ratio / base-unit`).
- `grid-auto-flow: dense` packs gaps. Trade-off: visual order may diverge from DOM order (accepted — DOM order is the cursor order from DB; screen readers and Tab navigation still walk that).
- Inter-card gap: tight on mobile (~2 px), grows slightly at larger breakpoints.
- Density toggle (compact / comfortable / spacious) swaps `--cols` and gap; persisted in `localStorage`.
- **`content-visibility: auto`** + `contain-intrinsic-size` on each card → native off-screen paint/layout skipping. No manual virtualization. No JS masonry library.
- Fallback path: if `dense` reflow proves visually unacceptable on real content, swap the gallery component to `svelte-bricks` or a hand-rolled packer. Schema/API/pagination contract are insulated — view-layer-only change.

## Image loading

- Card uses thumbnail: `/api/v1/images/[id]/thumbnail` → `<base-dir>/.thumbs/<uuid>.webp` (max 512×512, webp).
- `<img loading="lazy" decoding="async" width={img.width} height={img.height}>` — browser reserves layout space, zero CLS.
- Detail view uses original via `/api/v1/images/[id]/original`.
- No client-side resize / canvas trickery.

## Image detail flow

- **Card click** in gallery → navigate to `/images/[id]` (full SvelteKit page, **not** a modal).
- Detail page shows the original-sized image + metadata: title, source link, source tags, user tags, devices that have it, ingestion date, dimensions, file size, format, NSFW state.
- **Image click in detail** → open raw `/api/v1/images/[id]/original` in a new tab (`target="_blank" rel="noopener"`).

## NSFW UX

- Card gets `data-nsfw="sfw" | "nsfw" | "unknown"`.
- Global `nsfw_reveal` store reads `localStorage.wallrus.nsfw_reveal` (default `false`).
- CSS: `.card[data-nsfw="nsfw"]:not(.revealed) img { filter: blur(20px); }`.
- Top-bar toggle flips global; per-card click can flip a local `.revealed` class without flipping the global.

## Forms — Superforms

**WebUI forms go through `sveltekit-superforms`.** Reasons: nested data (device `filter_criteria`, source `params`), arrays (`tags`, `format[]`), progressive enhancement, typed field-level errors. Hand-rolling a flat-only path would re-implement Superforms badly. JSON POST mode (`dataType: 'json'`) lets nested objects round-trip cleanly.

### Same Zod schema in three places

A single Zod schema in `$lib/schemas/<domain>/<Op>.ts` serves:

1. Server **form action** (via `superValidate(..., zod(Schema))`).
2. Client **form component** (via `superForm({...}, { validators: zodClient(Schema) })`).
3. JSON **API endpoint** (via plain `Schema.parse(body)` in `/api/v1/*`).

One schema. No drift between WebUI and API.

### Server form action

```ts
// src/routes/devices/[id]/+page.server.ts
import { fail } from "@sveltejs/kit"
import { superValidate } from "sveltekit-superforms/server"
import { zod } from "sveltekit-superforms/adapters"
import { UpdateDeviceRequestSchema } from "$lib/schemas/devices/UpdateDevice"

export const load = async ({ params, locals }) => {
  const device = await locals.service.devices.getDevice({ id: params.id })
  const form = await superValidate(device, zod(UpdateDeviceRequestSchema))
  return { form, device }
}

export const actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, zod(UpdateDeviceRequestSchema))
    if (!form.valid) return fail(400, { form })
    await locals.service.devices.updateDevice(form.data)
    return { form }
  },
}
```

### Client component

```svelte
<script lang="ts">
  import { superForm } from "sveltekit-superforms/client"
  import { zodClient } from "sveltekit-superforms/adapters"
  import { UpdateDeviceRequestSchema } from "$lib/schemas/devices/UpdateDevice"

  let { data } = $props()

  const { form, errors, enhance, submitting } = superForm(data.form, {
    dataType: "json", // POST nested JSON, not FormData
    validators: zodClient(UpdateDeviceRequestSchema),
  })
</script>

<form method="POST" use:enhance>
  <input bind:value={$form.name} />
  {#if $errors.name}<span class="error">{$errors.name}</span>{/if}
  <!-- nested: $form.filter_criteria.resolution.min_width, etc. -->
</form>
```

### `ZodForm.svelte` shape

`ZodForm.svelte` is a thin component over `superForm()`. It walks the Zod schema and renders one `<Field>` per leaf using the adapter table below. Superforms owns state, validation, and submission lifecycle under the hood.

| Zod type               | Field                                                 |
| ---------------------- | ----------------------------------------------------- |
| `z.string()`           | `<Input type="text">`                                 |
| `z.number() / z.int()` | `<Input type="number">`                               |
| `z.boolean()`          | `<Switch>`                                            |
| `z.enum([...])`        | `<Select>`                                            |
| `z.array(z.string())`  | `<TagInput>`                                          |
| `z.object({...})`      | nested `<Fieldset>` recursing into the same component |

Subscription form delegates to `ZodForm` using the picked source's `params_schema` (already a Zod schema → works the same).

### Where the schemas live

Service request/response schemas (and DTO types) are at **`$lib/schemas/<domain>/<Op>.ts`** — the universal location. The corresponding server-side operation lives at `$lib/server/service/<domain>/<Op>.ts` (same filename) and is NOT importable from client code.

Import:

```ts
import {
  ListDevicesRequestSchema,
  type ListDevicesResponse,
} from "$lib/schemas/devices/ListDevices"
```

Same import line works from `.svelte`, `+page.ts`, `+page.server.ts`, `+server.ts`, and the service operation file. Pure Zod, no server deps.

## Live run progress (SSE)

- Endpoint: `GET /api/v1/runs/stream` (auth same as other API routes).
- Event names: `run.started`, `run.progress` (throttled ~1/sec per active run), `run.finished`.
- Client uses `lib/client/sse.ts` (typed `EventSource` wrapper, auto-reconnect on close).
- Dashboard subscribes once per session; appends/updates rows live.

## Accessibility

- All interactive elements keyboard-reachable (Bits UI handles focus).
- `<img alt={title || 'untitled'}>`.
- NSFW reveal: explicit click/tap + keyboard handler. Never hover-only.
- Color contrast ≥ AA on both themes.
- `prefers-reduced-motion` respected for non-essential transitions.

## URL state

- Gallery filters live entirely in the URL query string: `?source=reddit&device=phone-pixel&tag=landscape&nsfw=sfw_only&q=neon&page=4&next=<uuid>`.
- Bookmarkable, shareable, browser-back-friendly.
- Pagination query format defined in [`api.md`](./api.md).

## Build / caching

- SvelteKit immutable bundle hashing (`_app/immutable/*`).
- Static assets in `static/`.
- No service worker in MVP.

## Don't

- Don't introduce a second accent hue without explicit confirmation.
- Don't put glass on gallery cards.
- Don't add infinite scroll — pagination is page-based.
- Don't reach for `tanstack-query` / external server-state libs — `load()` + `invalidate*()` is enough.
- Don't call `fetch('/api/v1/...')` from `+page.server.ts` or `+server.ts` — call the service directly.
- Don't add a JS masonry library unless the `dense` fallback path explicitly triggers (gap density unacceptable on real content).
- Don't introduce a third font family.
