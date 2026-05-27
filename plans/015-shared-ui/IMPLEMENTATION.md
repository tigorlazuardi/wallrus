# 015 — Shared UI: presenter + hook split, universal load, SPA form actions

## Status

**done** — all three phases shipped: client foundation (`$client/config` + `apiFetch`), the devices pilot, and the subscriptions/images/runs verticals. Every `(app)` page now loads via `+page.ts` universal load through `/api/v1/*` and mutates through `$lib/client/<domain>/use-*` hooks (`apiFetch` → `api_base()`). The only surviving `+page.server.ts` are auth-only: `login/+page.server.ts` (sets the session cookie) and `(app)/+layout.server.ts` (auth gate reading `locals.user`). `frontend.md` §Data flow rewritten to match.

**Deferred to the user (not done in the autonomous Ralph loop):** interactive browser smoke (click-through of list/create/edit/delete/toggle, infinite scroll, filter nav) and the gallery SSR latency measurement. These need a running daemon + a browser; the daemon can't boot headless in this environment because of the pre-existing `sharp` `libstdc++` issue (the same one behind the 33 environmental test failures). Code-level verification is green: `bun run check` (0 errors), `bun run build` (succeeds), `bunx eslint .` (0 errors), `bunx prettier --check .` (clean), and the per-vertical hook + API-endpoint unit tests. A human should run the interactive smoke before treating the web UX as fully validated.

## Goal

Restructure the SvelteKit codebase so every UI vertical follows the
**Variant B** pattern: pure presenter components + composable data
hooks + thin per-context containers. Outcome is web-only — there is
**no mobile work in this slice**. The point is to make the existing
web app's UI layer reusable later (mobile shell lives in
[`016-mobile-shell`](../016-mobile-shell/)) and, in the meantime, gain
clearer separation between rendering, data fetching, and mutation.

Concretely: every list / detail / mutation page migrates from
`+page.server.ts` direct-service to:

- `+page.ts` **universal load** that fetches via `/api/v1/*`
- pure presenter components in `$lib/components/<domain>/*`
- composable hooks in `$lib/client/<domain>/use-*.svelte.ts`
- superforms `SPA: true` for mutations + client POST via mutation hooks
- single mutation surface = the existing `/api/v1/*` routes

## Decisions (pre-baked)

### Variant B locked, Variant A rejected

Rejected: component that dual-modes between `data` prop (SSR
prefill) and `endpoint` prop (fetches itself). Reasons documented
in chat: race conditions on prop change, doubled loading/error
state, SSR hydration mismatch, pagination state owned in wrong
layer, mutation invalidation can't reach internal fetcher.

Adopted: presenter / hook / container split.

```
$lib/components/<domain>/<Component>.svelte    # PURE presenter
  - props in (data + callbacks), no fetching, no SvelteKit imports
  - works identically in web SSR hydration AND future mobile webview

$lib/client/<domain>/use-<thing>.svelte.ts     # composable hook
  - Svelte 5 rune state ($state, $derived)
  - takes optional `initial` data (skip fetch if provided)
  - exposes { state, refetch } for queries; { create, update, ... }
    for mutations
  - calls $client/config.api_base() for URL

src/routes/(app)/<page>/+page.svelte            # web container (thin)
  - reads $props().data (from +page.ts universal load)
  - useFoo(data.foo) — initial set, no extra fetch on first render
  - passes presenter props + wires callbacks (goto, invalidateAll, etc.)
```

### Hook contract — locked

Query hook shape:

```ts
// $lib/client/devices/use-devices.svelte.ts
import {
  ListDevicesResponseSchema,
  type ListDevicesResponse,
} from "$lib/schemas/devices/ListDevices"
import { api_base } from "$lib/client/config"

export function useDevices(initial?: ListDevicesResponse) {
  let state = $state<{
    data: ListDevicesResponse | null
    loading: boolean
    error: Error | null
  }>({
    data: initial ?? null,
    loading: !initial,
    error: null,
  })

  async function refetch() {
    state.loading = true
    try {
      const res = await fetch(`${api_base()}/api/v1/devices`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      state.data = ListDevicesResponseSchema.parse(await res.json())
      state.error = null
    } catch (e) {
      state.error = e as Error
    } finally {
      state.loading = false
    }
  }

  if (!initial) refetch()
  return { state, refetch }
}
```

Mutation hook returns action functions, no internal state:

```ts
// $lib/client/devices/use-device-mutation.svelte.ts
export function useDeviceMutation() {
	return {
		async create(input: CreateDeviceRequest) { ... },
		async update(input: UpdateDeviceRequest) { ... },
		async delete(id: string) { ... },
		async toggle(input: ToggleDeviceRequest) { ... },
	}
}
```

### Dynamic API base URL — same scaffold as mobile prep

```ts
// $lib/client/config.ts
let _api_base = ""

export function set_api_base(url: string) {
  _api_base = url.replace(/\/$/, "")
}

export function api_base(): string {
  return _api_base || import.meta.env.PUBLIC_API_BASE || ""
}
```

- **Web**: `PUBLIC_API_BASE=""` (empty → relative fetch, same origin).
- **Mobile (deferred)**: set at boot from preferences. This slice
  ships the helper but never calls `set_api_base()` — that wiring
  lives in slice 016.

### Form action migration

Web today: `+page.server.ts` form actions with superforms server
validation + direct service call.

Migrated: superforms `SPA: true` + client POST via mutation hook.

```ts
const { form, enhance, errors, submitting } = superForm(data.form, {
  dataType: "json",
  SPA: true, // KEY: bypass form action
  validators: zodClient(UpdateDeviceRequestSchema),
  onUpdate: async ({ form, cancel }) => {
    if (!form.valid) return
    try {
      await useDeviceMutation().update(form.data)
      await invalidateAll()
      await goto(`/devices/${form.data.slug}`)
    } catch (e) {
      form.message = (e as Error).message
      cancel()
    }
  },
})
```

Server form action gets deleted from `+page.server.ts` for migrated
pages. `/api/v1/*` is now the single mutation surface — exactly
matches the architectural intent in `.claude/rules/frontend.md`
"same Zod schema in three places" (the third place — pure JSON API
endpoint — was already wired but underused).

### Universal load migration

Every page's `+page.server.ts` `load()` → `+page.ts` `load()`:

```ts
// EXAMPLE — web container, universal load
// src/routes/(app)/devices/+page.ts
import { ListDevicesResponseSchema } from "$lib/schemas/devices/ListDevices"

export const load = async ({ fetch }) => {
  const res = await fetch("/api/v1/devices")
  return {
    devices: ListDevicesResponseSchema.parse(await res.json()),
  }
}
```

Web SSR cost: one in-process loopback HTTP per first paint
(~1-5 ms). Acceptable trade for the architectural cleanup. Measure
during phase 2 pilot — if any page shows perceptible regression,
keep it on `+page.server.ts` and add to a "web-only" allowlist.

### Rule update

`.claude/rules/frontend.md` §Data flow currently reads:

> Server `load()` and form actions call services directly — never
> `fetch` to your own `/api/v1/*` from server code. Direct service
> call is faster, type-safe, and bypasses auth re-checks.

After this slice the rule flips to:

> Pages use `+page.ts` universal load via `fetch("/api/v1/...")`.
> Forms use superforms `SPA: true` + client POST via a mutation hook
> in `$lib/client/<domain>/use-*-mutation.svelte.ts`. The only place
> that still uses `+page.server.ts` direct-service is the auth flow
> (`/login`) and any explicitly tagged "web-only" page. The
> single mutation surface is `/api/v1/*`.

### Presenter purity

Component in `$lib/components/<domain>/*` MUST NOT:

- import from `+page.server.ts` or `+page.ts`
- read `$app/stores` / `$app/state` `page` directly
- call `fetch()` to any URL
- import `$lib/server/*`

Component MAY:

- import schemas from `$lib/schemas/*`
- import primitives from `$lib/components/ui/*`
- import icons from `lucide-svelte`
- emit events via `$props()` callbacks (`onEdit`, `onDelete`, etc.)
- read theme tokens via CSS variables (post slice 014)

Audit existing components, refactor offenders.

### Auth flow stays on `+page.server.ts`

`/login` keeps server form action — the session cookie must be set
via the server `Set-Cookie` header in a way that the browser
trusts. Migrating it to client POST would require returning the
cookie in the API response anyway. Net: no win, defer indefinitely.

### Out of scope (in this slice)

- Capacitor scaffold, dual adapter build, native plugins, mobile
  release wiring → all in [`016-mobile-shell`](../016-mobile-shell/).
- Token-based mobile auth — keep cookie-only for now.
- TanStack Query / svelte-query — explicit `frontend.md` ban
  remains; `invalidateAll()` + hook `refetch()` are enough.
- Optimistic updates — defer; current refetch-after-mutate is fine
  at homelab scale.

## State at start

- All web pages use `+page.server.ts` with direct-service calls
  (`runtime_ref().services.*`).
- Form actions on every mutation page.
- No `$lib/client/<domain>/use-*` hooks exist.
- No `$lib/client/config.ts`.
- `$lib/client/fetcher.ts` + `$lib/client/sse.ts` exist (per slice
  013), but `fetcher.ts` uses relative URLs only.
- Components in `$lib/components/*` mostly props-driven; partial
  presenter purity expected but unverified.

## Resume here

### Phase 1 — client foundation

1. Create `$lib/client/config.ts` with `api_base()` /
   `set_api_base()`.
2. Update `$lib/client/fetcher.ts` to call `api_base()` for every
   `/api/v1/*` URL (existing wrapper).
3. Unit tests for `config.ts` + `fetcher.ts`.

### Phase 2 — pilot vertical: devices

4. Create `$lib/client/devices/use-devices.svelte.ts`,
   `use-device.svelte.ts`, `use-device-mutation.svelte.ts`.
5. Audit `src/lib/components/devices/*` for presenter purity.
   Refactor offenders.
6. Convert `src/routes/(app)/devices/+page.server.ts` →
   `+page.ts` universal load.
7. Convert `src/routes/(app)/devices/new/+page.server.ts` form
   action → superforms `SPA: true` + `useDeviceMutation().create`.
8. Same for `[slug]/edit/+page.server.ts`.
9. Same for any toggle / delete API route handled via form action.
10. Delete superseded server form actions.
11. Manual smoke web: list / create / edit / delete / toggle work
    identically to pre-migration.
12. Hook unit tests.

### Phase 3 — remaining verticals

13. Subscriptions vertical (mirror phase 2).
14. Images / gallery vertical (cursor pagination — hook owns
    cursor state).
15. Runs vertical (SSE stream stays as-is per slice 013; only
    list/detail data fetch migrates).
16. Update `.claude/rules/frontend.md` §Data flow with the new rule
    text from §Decisions.
17. Audit every remaining `+page.server.ts` — keep only `/login`
    and any explicitly "web-only" page; tag the rest as migrated.
18. Final manual smoke across every page.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green — hook unit tests + existing component tests
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Manual smoke: every migrated page works identically to before
- [ ] Per-page sanity: server load deleted, `+page.ts` universal load
      present, form actions deleted, `SPA: true` superform present
- [ ] Latency check on a representative page (devices list) — confirm
      SSR first-paint regression is in single-digit ms range; if not,
      add page to web-only allowlist with a note

## Done definition

Suggested commit chain (one Conventional Commit per phase):

```
feat(client-config): runtime-configurable API base URL via $client/config
feat(shared-ui): extract devices vertical to presenter + hook + universal load
feat(shared-ui): migrate subscriptions/images/runs to presenter + hook pattern
chore(plans): mark 015-shared-ui done
```

Then `chore(plans): mark 015-shared-ui done` updates IMPLEMENTATION.md

- README index row.

## Gotchas / Deferred

- **SSR loopback cost**: every migrated page pays one in-process HTTP
  hop on first paint. Localhost = single-digit ms. Acceptable but
  measure on the heaviest page (gallery with 60 thumbnails) before
  declaring victory.
- **Auth check now runs per load**: `hooks.server.ts` auth gate fires
  on every `/api/v1/*` call. Universal load triggers it on SSR too.
  Cookie parsing is cheap (~µs), but if any page becomes slow,
  inspect whether the auth gate is dominating.
- **`invalidateAll()` vs scoped `invalidate()`**: hooks expose
  `refetch()` directly — UI code that's already past a successful
  mutation should call the specific hook's `refetch()` rather than
  `invalidateAll()` (which re-runs every load on the page). Wire
  case-by-case during phase 2.
- **Schema imports from page**: keep importing from `$lib/schemas/*`
  in `+page.ts` for runtime parse safety. Type-only imports also OK
  for compile-time work.
- **Mutation response shapes**: API endpoints already return the
  updated resource. Mutation hooks parse the response via
  `<Op>ResponseSchema.parse()` for type narrowing.
- **No SSE change**: `lib/client/sse.ts` and `runs-stream.ts` from
  slice 013 work unchanged — SSE was already client-only.
- **Mobile prep**: slice 016 builds on top of this. Phase 1's
  `$client/config.ts` is the seed for mobile's runtime base URL,
  but this slice never calls `set_api_base()` itself.
- **Don't add svelte-query / tanstack** — the rule remains; hooks
  - `refetch()` cover the homelab scale.
