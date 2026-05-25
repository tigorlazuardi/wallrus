# 018 — AR tolerance semantic: percent instead of absolute delta

## Status

**done**

## Goal

Switch aspect-ratio tolerance from "absolute delta" semantics to
"fractional percent" semantics so the same tolerance value behaves
consistently across portrait phones, landscape monitors, and ultrawide
displays. UI displays tolerance as an integer percentage; storage
stays as a 0..1 fraction.

Slice 017 surfaced the tolerance field but the help text I wrote
described percent semantics (`target × (1 ± tolerance)`) while the
actual filter used absolute delta (`abs(actual - target) > tolerance`).
This slice realigns the filter to percent semantics — the UX the user
actually wanted — and fixes the UI label/help text accordingly.

## Decisions (pre-baked)

### Storage stays as 0..1 fraction; UI shows percent

- DB column / Zod schema unchanged: `aspect_ratio.tolerance: number`,
  range `0..1`, default empty.
- UI input shows the value × 100 (e.g. `0.1` in storage → `10` in
  the input). On input change, divide by 100 before writing back to
  `$form.filter_criteria.aspect_ratio.tolerance`.
- Placeholder `10`, label `Tolerance (%)`, step `1` (integer percent).
  Range `0..100`.
- Schema `max(1)` constraint stays — UI prevents typing above 100,
  divide gives ≤1.

### Filter logic — percent

`src/lib/server/ingest/filters.ts`:

```ts
// before
Math.abs(actual_ratio - criteria.aspect_ratio.target) > criteria.aspect_ratio.tolerance

// after
Math.abs(actual_ratio / criteria.aspect_ratio.target - 1) > criteria.aspect_ratio.tolerance
```

Edge case: if `criteria.aspect_ratio.target === 0` the division
explodes. Zod already enforces `target` is positive (or unset), so
this branch only runs when both `target > 0` and `tolerance ≥ 0`.
Belt-and-braces: short-circuit on `target <= 0` returning `pass: true`
for the AR rule (no opinion when target is invalid).

### Help text — rewrite

UI under the AR fields:

> Image AR must match target within ± tolerance%. e.g. target 1.78,
> tolerance 10 → accepts 1.60-1.96.

(Matches the percent formula exactly.)

### Existing data — silent semantic shift, acceptable

Slice 017 just landed. Any tolerance values already in the DB were
saved under absolute-delta semantics and now mean percent semantics.
For single-user homelab scale, manual re-tune via the edit form is
fine. No migration script.

If user feedback shows existing devices got broken, a one-shot SQL
update can recompute `tolerance = old_tolerance / target` to preserve
the same absolute window. **Not** doing this proactively — the cost is
finding broken devices, which only the user can verify visually.

### Default first-edit tolerance stays `0.1` (now means 10%)

Slice 017's "first edit of target default-populates tolerance to 0.1"
behavior stays. The stored value is the same; only the semantic of
that value changes. UI shows it as `10` after this slice lands.

### Slice 017 not retroactively edited

Slice 017 is `done`. Per `plans/README.md` §Rules, done slices are
historical record. This slice (018) supersedes the semantic without
modifying 017's docs.

## State at start

- `aspect_ratio.tolerance` stored as 0..1 fraction.
- Filter logic uses absolute delta.
- UI displays raw fraction with label `Tolerance (± fraction)`,
  placeholder `0.10`.
- Help text describes percent formula (wrong — historical artifact
  from slice 017).
- Filter tests assert absolute-delta behavior.

## Resume here

1. **Filter logic**: update `src/lib/server/ingest/filters.ts` line
   76 to the percent comparison. Add `target > 0` guard.
2. **Filter tests**: `src/lib/server/ingest/filters.test.ts` —
   update any AR-tolerance assertions. Add a test for the
   `target === 0` edge case (should pass).
3. **UI input**: `src/lib/components/FilterEditor.svelte`
   tolerance input:
   - Local state: derive `tolerance_pct_str` from
     `$form.filter_criteria.aspect_ratio.tolerance * 100` rounded to
     integer.
   - Input bound to `tolerance_pct_str`. On change, parse to
     number, divide by 100, write to form.
   - Label `Tolerance (%)`, placeholder `10`, `min="0"` `max="100"`
     `step="1"`.
   - First-edit default-populate logic: `tolerance` value stays
     `0.1` (= 10%) — no change.
4. **Help text**: rewrite under the AR section per §Decisions.
5. **Run gates**: `bun run check`, `bun test`, `bunx eslint .`,
   `bunx prettier --check .`.
6. **Manual smoke**: enter target 1.78, tolerance 10 → save → reopen
   → tolerance input shows `10` (not `0.1`). Filter accepts an
   image with AR 1.85 (within 10% of 1.78), rejects one with AR 1.5.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green (filters tests updated, all pass)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Manual smoke: percent input round-trips, filter accepts/rejects
      per the new semantic, help text reads correctly

## Done definition

```
fix(devices-filter): aspect ratio tolerance is now fractional percent, not absolute delta
```

Body: filter logic + tests + UI display + help text. Co-author. Push.
Then `chore(plans): mark 018-ar-tolerance-percent done`.

## Gotchas / Deferred

- **Silent semantic shift**: existing devices keep their stored
  tolerance value (e.g. `0.1`), but the meaning changes. If user has
  any devices with non-trivial AR filters, they must re-tune via the
  edit form. Surface in commit body so future-self knows.
- **No DB migration**: column type and range unchanged.
- **No filter tests for `target = 0` previously**: add one; the
  short-circuit guard makes behavior deterministic.
- **Don't change the schema range**: keep `tolerance` as
  `z.number().min(0).max(1)`. The UI handles ×100 conversion. Schema
  stays a fraction so the contract document `frontend.md` claim
  ("same Zod schema in three places") stays accurate.
- **Edit form has same conversion**: `FilterEditor.svelte` is shared
  between new + edit pages per slice 017 builder's design decision.
  Single component update covers both.
