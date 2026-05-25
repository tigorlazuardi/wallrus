# 017 — Device form polish — tasks

## Migration + DB schema

- [x] `drizzle/migrations/0004_device_native_resolution.sql` — `ALTER TABLE devices ADD COLUMN native_width INTEGER;` + same for `native_height`
- [x] `src/lib/server/db/schema.ts` — add `native_width: integer("native_width")` + `native_height: integer("native_height")` to `devices` table (both nullable)
- [x] Confirm migrator picks up `0004*.sql` (no code change expected — drizzle migrator iterates the dir)
- [x] Migration smoke: fresh dev DB applies all 5 migrations cleanly

## Zod schemas

- [x] `src/lib/schemas/devices/Device.ts` — add `native_width` + `native_height` optional positive ints (`z.number().int().positive().max(32768).optional().nullable()`); update `Device` DTO type
- [x] `src/lib/schemas/devices/CreateDevice.ts` — same fields on request schema
- [x] `src/lib/schemas/devices/UpdateDevice.ts` — same fields on request schema (`partial()` semantics already in place)
- [x] If `ListDevicesResponse` re-exports `Device`, no further changes needed; otherwise confirm new fields surface in list response

## Service + API

- [x] `src/lib/server/service/devices/CreateDevice.ts` — confirm new fields flow into `db.insert(devices).values({...})` (likely no change beyond pulling from input)
- [x] `src/lib/server/service/devices/UpdateDevice.ts` — same for `db.update(devices).set({...})`
- [x] `src/lib/server/service/devices/GetDevice.ts` — confirm select includes new columns (Drizzle auto-includes; check the column list if explicit)
- [x] `src/lib/server/service/devices/ListDevices.ts` — same
- [x] Service tests adjusted: existing fixtures probably set every device field; add `native_width`/`native_height` to a couple of them to exercise the new path

## Slugify helper

- [x] `src/lib/util/slugify.ts` — pure function: lowercase, NFKD normalize, strip diacritics, non-alnum runs → `-`, collapse multiple `-`, trim leading/trailing `-`, max 64 chars
- [x] `src/lib/util/slugify.test.ts` — cases: `"Pixel 9 Pro"` → `"pixel-9-pro"`, `"  Test--Foo  "` → `"test-foo"`, `"pixel café"` → `"pixel-cafe"`, `"🚀 rocket"` → `"rocket"`, `""` → `""`, `"a".repeat(100)` truncates at 64

## New-device form (`src/routes/(app)/devices/new/+page.svelte`)

- [x] Reorder: Name field first, Slug field second
- [x] Slug input help text: "Auto-derived from name until you edit it. Lowercase, alphanumeric + hyphens."
- [x] Add `slug_dirty: boolean = $state(false)`
- [x] Name input handler: update `$form.name`; if `!slug_dirty` set `$form.slug = slugify($form.name)`
- [x] Slug input handler: update `$form.slug`; set `slug_dirty = true`
- [x] Add "Native resolution" section above the existing "Resolution" (acceptance) section: two number inputs (Width, Height) bound to `$form.native_width` / `$form.native_height`
- [x] Add Tolerance input next to AR Target: number, step 0.01, placeholder `0.10`, bound to `$form.filter_criteria.aspect_ratio.tolerance`
- [x] Add `ar_target_dirty: boolean = $state(false)`, initialized `false` for new device
- [x] `$effect`: when both native_width + native_height present and !ar_target_dirty, set `$form.filter_criteria.aspect_ratio.target` to `native_width / native_height` rounded to 4 decimals
- [x] AR Target input handler: update value + set `ar_target_dirty = true`
- [x] First-edit-of-target default: if user types in target and tolerance is empty/0, default-populate tolerance to `0.1`
- [x] Help text under AR fields: "Image AR must be within target × (1 ± tolerance). e.g. target 1.78, tolerance 0.1 → accepts 1.60–1.96."

## Edit-device form (`src/routes/(app)/devices/[slug]/edit/+page.svelte`)

- [x] Add Native resolution section (same shape as new-device)
- [x] Add Tolerance input next to AR Target (same shape)
- [x] `ar_target_dirty` initialized `$form.filter_criteria?.aspect_ratio?.target != null` (preserve existing target on first render)
- [x] AR auto-derive `$effect` wired same as new-device
- [x] NO slug auto-gen on edit (slug stays editable, user edits intentionally)

## FilterEditor.svelte (if applicable)

- [x] If filter_criteria UI is extracted to `src/lib/components/FilterEditor.svelte`, AR section lives there; pass tolerance binding through props. If still inline in `+page.svelte`, leave alone.

## Placeholder color

- [x] `src/app.css` — add `::placeholder { color: var(--color-fg-muted); opacity: 0.5; }` global rule
- [x] Manual contrast check both modes; tweak per-mode opacity if needed

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green (new slugify + adjusted service fixtures)
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [x] Migration applies on fresh dev DB
- [ ] Manual smoke: new-device name→slug live derive, slug locks on user edit, native res→AR target live, AR target locks, tolerance default 0.1 default-populates on first target edit, edit-device same but no slug auto-gen, placeholder text visibly muted on both modes
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(devices-form): native resolution + AR auto-derive + slug auto-gen + placeholder fix` (or split as the builder sees fit)
- [ ] Co-author trailer + push
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated for `017-device-form-polish`
- [ ] `chore(plans): mark 017-device-form-polish done`
