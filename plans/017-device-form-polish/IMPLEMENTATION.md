# 017 — Device form polish: native resolution, auto-derive, placeholder

## Status

**not-started**

## Goal

Make the new-device / edit-device forms feel like a real form, not a
spreadsheet. Four bundled fixes driven by user feedback after slice 014
shipped the warm Mocha Latte theme:

1. **Name first, slug second**, with the slug auto-deriving from the
   name on every keystroke UNTIL the user types in the slug field
   themselves (dirty flag locks it).
2. **Native resolution on the device** (`native_width` + `native_height`
   columns). User inputs the device's intrinsic resolution; the form
   uses this to drive AR auto-derive. Pure metadata for UX — does NOT
   affect ingest logic.
3. **Aspect-ratio target auto-derives** from native width / height
   with the same dirty-flag pattern as slug. **Tolerance** field
   surfaced (was already in schema but UI never exposed it). Default
   `0.1` (10%).
4. **Placeholder text** color too strong in light Mocha Latte — fields
   read as "filled" when they're empty. Mute placeholder globally.

## Decisions (pre-baked)

### Scope expansion — `devices.native_width` + `devices.native_height`

`engineering/SCOPE.md` currently defines Device = "named target (slug,
filter criteria, enabled)". This slice adds two intrinsic resolution
columns. Rationale: the UX wants AR target auto-derive, and the only
honest source is the device's native resolution. Filter criteria
(min/max width/height) are different — they're acceptance bounds, not
the device's actual screen. Adding it now keeps filter criteria
unambiguous.

- Both columns: `INTEGER`, nullable. Existing devices (already in DB)
  ship without values — UI shows empty inputs, AR auto-derive becomes a
  no-op until the user fills them.
- No CHECK constraint beyond "positive integer when present". Zod
  enforces `int().positive().max(32768)` at the boundary.
- No FTS5 integration (native_width / native_height are numbers, not
  search-indexable).
- No effect on `images`, `subscriptions`, `run_history`. Migration is
  additive only — no backfill, no data change.

### Migration

`drizzle/migrations/0004_device_native_resolution.sql`:

```sql
ALTER TABLE devices ADD COLUMN native_width INTEGER;
ALTER TABLE devices ADD COLUMN native_height INTEGER;
```

Drizzle schema (`src/lib/server/db/schema.ts`) gets matching
`integer("native_width")` + `integer("native_height")` columns on the
`devices` table, both nullable.

### Slug auto-gen — locked behavior

- Helper: `src/lib/util/slugify.ts` exports `slugify(input: string): string`.
- Algorithm: lowercase → NFKD normalize → strip combining diacritics →
  non-alphanumeric runs → `-` → collapse multiple `-` → trim leading /
  trailing `-` → truncate at 64 chars. Empty input → empty string.
- Form state: `slug_dirty: boolean = $state(false)`.
- Name input handler: updates `$form.name`; if `!slug_dirty`,
  `$form.slug = slugify($form.name)`.
- Slug input handler: updates `$form.slug`; sets `slug_dirty = true`.
- **New-device page only.** Edit page slug input has no auto-derive
  (slug already set, user is intentionally renaming).
- Unit tests for `slugify` covering: ASCII passthrough, spaces, double
  spaces, leading/trailing whitespace, diacritics (`pixel café` →
  `pixel-cafe`), unicode emoji stripped, max-length truncation, empty
  input.

### AR target auto-derive — locked behavior

- New form state: `ar_target_dirty: boolean = $state(false)`.
- Effect: when `native_width` AND `native_height` both present and
  numeric and `!ar_target_dirty`,
  `$form.filter_criteria.aspect_ratio.target = native_width / native_height`
  rounded to 4 decimal places.
- Target input handler: updates value + sets `ar_target_dirty = true`.
- Applies to **both new and edit pages**. On edit, if user changes
  `native_width` or `native_height` and target hasn't been dirtied,
  target updates.
- Tolerance: separate input, default `0.1`. Range `0..1`. Step `0.01`.
  Label "Tolerance (± fraction)". Help text under it: "Image AR must
  be within `target × (1 ± tolerance)`. e.g. target 1.78, tolerance
  0.1 → accepts 1.60-1.96."
- If user sets `target` but leaves `tolerance` at 0, the schema's
  existing behavior applies (exact match → almost never matches). UI
  should default-populate `tolerance: 0.1` when user first types into
  target.

### Placeholder color fix

Add global CSS in `src/app.css`:

```css
::placeholder {
  color: var(--color-fg-muted);
  opacity: 0.5;
}
```

Tested against both light Mocha Latte and dark Mocha. If contrast still
reads too low on one mode, override per-mode (e.g. `[data-theme="dark"]
::placeholder { opacity: 0.6; }`).

Do NOT touch the shadcn `Input.svelte` chrome for this — `::placeholder`
is a universal pseudo-element, single rule covers every input,
textarea, contenteditable.

### Field order on new-device form

```
Name *
Slug    (auto from name until manually edited; help text mentions this)
─────── Filter criteria ───────
Native resolution
  Width   |  Height
  (helper: "Used to auto-derive AR target below")
Resolution (acceptance)
  Min width / Max width / Min height / Max height
Aspect ratio
  Target (auto from native res unless manually edited) | Tolerance (default 0.1)
File size
  Min size MB / Max size MB
Allowed formats
Tags
NSFW
```

Edit-device form: same shape minus the slug auto-gen. Slug input is
still editable (rename allowed, schema permits).

### What does NOT change

- `images` schema, ingest pipeline, scheduler — untouched.
- Filter logic (`acceptsImage()` or equivalent) — already handles
  `tolerance` per existing `aspect_ratio: { target, tolerance }`. No
  service-layer change.
- Subscription form — no slug/AR.
- API endpoints `/api/v1/devices/*` — only schema changes flow through;
  no new endpoints, no new operations.

## State at start

- Slice 014 closed (warm Mocha Latte + theme toggle live).
- `devices` table has no `native_width`/`native_height` columns.
- `src/lib/schemas/devices/Device.ts` (and `CreateDevice`,
  `UpdateDevice`) only know `filter_criteria.aspect_ratio.target +
tolerance` — no native res fields.
- Form `src/routes/(app)/devices/new/+page.svelte` shows Slug above
  Name. Tolerance hidden. Target manually input.
- No `slugify()` helper exists in `src/lib/util/`.
- `::placeholder` styling falls back to browser default (too dark
  against warm latte bg).

## Resume here

1. **Migration**: write `drizzle/migrations/0004_device_native_resolution.sql`
   with the two `ALTER TABLE` statements above. Verify via
   `bun run src/cli.ts migrate` against a fresh dev DB (or read
   migrate.ts to confirm runner picks up `0004*.sql`).
2. **Drizzle schema**: add `native_width` + `native_height` columns
   (`integer("native_width")` etc., nullable) to the `devices` table
   in `src/lib/server/db/schema.ts`.
3. **Zod schemas**: add `native_width: z.number().int().positive().max(32768).optional()`
   - `native_height: ...` to `Device.ts`, `CreateDevice.ts`,
     `UpdateDevice.ts`. Update DTO types.
4. **Service**: `CreateDevice.ts` and `UpdateDevice.ts` already accept
   the schema — just confirm new fields flow through (Drizzle insert/
   update; no extra validation needed since Zod handles it).
5. **Slugify helper**: `src/lib/util/slugify.ts` + `slugify.test.ts`.
6. **New-device form**:
   - Reorder fields per the layout above.
   - Wire `slug_dirty` state + name/slug input handlers.
   - Add Native resolution section (Width + Height number inputs).
   - Wire `ar_target_dirty` state + native-res effect → target
     derivation.
   - Surface Tolerance input with default `0.1`.
7. **Edit-device form**:
   - Add Native resolution section (no auto-gen for slug).
   - Wire AR target auto-derive (same dirty flag pattern).
   - Surface Tolerance input.
8. **Placeholder CSS**: add the `::placeholder` rule to `src/app.css`.
   QA both light + dark modes for contrast.
9. **Run gates**: `bun run check`, `bun test`, `bunx eslint .`,
   `bunx prettier --check .`.
10. **Manual smoke** (reviewer): `bun run dev`, fill name on new-device
    form → slug fills live, type in slug → slug stops following, type
    native res → target updates, change target → stays. Edit existing
    device confirms same behavior minus slug auto-gen.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green (new slugify tests + any schema tests adjusted)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Migration runs cleanly on a fresh dev DB
- [ ] Manual smoke: all four behaviors confirmed in browser (light +
      dark mode for placeholder check)

## Done definition

Suggested commit chain:

```
feat(devices): native resolution columns + AR target auto-derive + tolerance UI
feat(ui): slug auto-gen on new device + mute placeholder + name-first field order
chore(plans): mark 017-device-form-polish done
```

Or single commit if the work splits cleanly:

```
feat(devices-form): native resolution + AR auto-derive + slug auto-gen + placeholder fix
```

(Builder picks; commit message has to reference scope `devices` or
`devices-form` per Conventional Commits convention used in the repo.)

## Gotchas / Deferred

- **AR auto-derive on edit page**: if a device already has a `target`
  set (from before this slice) AND user opens the edit form, the
  dirty flag should default `true` so the existing target doesn't get
  overwritten on first effect run. Initialize `ar_target_dirty =
$form.filter_criteria?.aspect_ratio?.target != null`.
- **Slug change on edit**: schema permits slug rename, but renaming
  has knock-on effects (URL changes, on-disk dir rename). Out of scope
  for this slice — slug input on edit stays editable per current
  behavior, but no validation against existing on-disk dir.
- **Placeholder contrast in dark mode**: if `opacity: 0.5` reads too
  low against `#1e1e2e`, bump to `0.55` for dark only. Verify during
  manual smoke before committing.
- **No backfill** of `native_width`/`native_height` for existing
  devices. Users will fill them via edit form when they care. AR
  auto-derive simply stays inactive until both filled.
- **Tolerance = 0 edge case**: if user clears tolerance to 0,
  acceptance becomes exact AR match (current schema behavior). UI
  should make this visible — placeholder "0.10" + help text. Don't
  silently default-populate on form load (only on first edit of
  target).
- **No tests for the form behavior itself** (slug/AR effects) —
  Playwright e2e blocker still applies (slices 011-013 deferred).
  Unit tests for `slugify` cover the pure logic; effect wiring is
  smoke-tested manually.
- **Scope marker in commit body**: slice slug `device-form-polish` is
  long; commit scope can use just `devices` or `devices-form` for
  brevity, as long as the slice slug appears in the commit body so
  `git log` threads back.
