# 018 — AR tolerance percent — tasks

## Filter logic

- [x] `src/lib/server/ingest/filters.ts` line ~73-79 — replace `Math.abs(actual_ratio - target) > tolerance` with `Math.abs(actual_ratio / target - 1) > tolerance`
- [x] Add `target > 0` guard: if target invalid, skip the AR check (return pass for this rule)

## Filter tests

- [x] `src/lib/server/ingest/filters.test.ts` — update existing AR-tolerance assertions to percent semantics
- [x] Add test: `target = 1.78, tolerance = 0.1, actual = 1.85` → pass (within 10%)
- [x] Add test: `target = 1.78, tolerance = 0.1, actual = 1.5` → fail
- [x] Add test: `target = 0.5, tolerance = 0.1, actual = 0.55` → pass (10% of 0.5 = 0.05, actual is 0.55 = ratio 1.1, within tolerance)
- [x] Add edge-case test: `target = 0, tolerance = 0.1` → pass (no opinion when target invalid)

## UI

- [x] `src/lib/components/FilterEditor.svelte` tolerance input:
  - [x] Local state `tolerance_pct_str` derived from form value × 100, rounded to integer
  - [x] Input bound to `tolerance_pct_str`; on change, parse + divide by 100 + write to `$form.filter_criteria.aspect_ratio.tolerance`
  - [x] Label: "Tolerance (%)"
  - [x] Placeholder: "10"
  - [x] `min="0" max="100" step="1"`
- [x] Help text under AR section: "Image AR must match target within ± tolerance%. e.g. target 1.78, tolerance 10 → accepts 1.60-1.96."
- [x] First-edit default-populate: still `0.1` in storage (= 10% in UI), unchanged

## Verification gates

- [x] `bun run check` clean
- [x] `bun test` green (all updated filter tests pass)
- [x] `bunx eslint .` zero errors
- [x] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Manual smoke: tolerance round-trips as percent, filter accepts/rejects per new semantic, help text accurate

## Commit + push

- [ ] `fix(devices-filter): aspect ratio tolerance is now fractional percent, not absolute delta`
- [ ] Body notes silent semantic shift for existing devices
- [ ] Co-author trailer + push
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated for `018-ar-tolerance-percent`
- [ ] `chore(plans): mark 018-ar-tolerance-percent done`
