# 014 — UI theme: warm Mocha Latte + dark mode toggle

## Status

**done**

## Goal

Replace the current cold pure-black + flat-white chrome with a warm,
**light-primary** palette (Catppuccin-Latte-warmed → "Mocha Latte") plus
proper Catppuccin Mocha dark mode + a working theme toggle. Soften the
"industrial terminal" feel reported on `/devices/new` (transparent
border-only inputs, unfilled fieldsets, sharp corners) by adding surface
fills, a medium radius (10/14 px), and an anti-FOUC mount hook so the
theme applies before first paint.

## Decisions (pre-baked)

### Palette — locked

Reviewer + user picked **Mocha Latte (light primary) + Catppuccin Mocha
(dark)**. Token blocks below are normative — do not invent shades. Use
these literal values in `src/app.css`.

```css
/* DEFAULT — LIGHT (Mocha Latte, primary) */
:root,
:root[data-theme="light"] {
  color-scheme: light;
  --color-bg: #ece5d8; /* warm latte */
  --color-bg-elev: #f5efe3;
  --color-surface: rgb(76 79 105 / 0.06);
  --color-surface-hi: rgb(76 79 105 / 0.1);
  --color-glass: rgb(236 229 216 / 0.75);
  --color-glass-border: rgb(76 79 105 / 0.1);
  --color-fg: #463f55; /* warm slate */
  --color-fg-muted: #756d7d;
  --color-accent: #8839ef; /* Catppuccin mauve */
  --color-accent-fg: #ece5d8;
  --color-ring: rgb(136 57 239 / 0.4);
}

/* DARK (Catppuccin Mocha proper) */
:root[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #1e1e2e; /* base */
  --color-bg-elev: #181825; /* mantle */
  --color-surface: #313244; /* surface0 */
  --color-surface-hi: #45475a; /* surface1 */
  --color-glass: rgb(30 30 46 / 0.65);
  --color-glass-border: rgb(205 214 244 / 0.08);
  --color-fg: #cdd6f4; /* text */
  --color-fg-muted: #a6adc8; /* subtext0 */
  --color-accent: #cba6f7; /* mauve */
  --color-accent-fg: #1e1e2e;
  --color-ring: rgb(203 166 247 / 0.4);
}

/* Shared geometry */
@theme {
  --radius: 10px; /* inputs, buttons, small chrome */
  --radius-card: 14px; /* cards, fieldsets, dialogs */
  --blur-chrome: 20px;
}
```

### Theme toggle behavior

- Three states: `'light' | 'dark' | 'system'`. `'system'` resolves at
  read time via `matchMedia('(prefers-color-scheme: dark)')`.
- Persisted in `localStorage.wallrus.theme` (key namespaced per
  `.claude/rules/frontend.md` convention).
- Default for fresh visitor: `'system'`. If system can't be detected
  (SSR, no JS), HTML ships with `data-theme="light"` so first paint is
  light-mode (primary).
- Anti-FOUC: inline `<script>` in `src/app.html` runs **before** body,
  reads localStorage + system pref, sets `document.documentElement
.dataset.theme` synchronously. No flash on hard refresh.

### Component chrome updates

- Inputs / textareas / selects / number inputs: add
  `bg-[var(--color-surface)]` and `rounded-[var(--radius)]`. Border
  stays but goes to `border-[var(--color-glass-border)]` (subtle).
  Focus ring uses `--color-ring`.
- Cards + fieldsets ("Filter criteria" box, etc.): add
  `bg-[var(--color-bg-elev)]` + `border-[var(--color-glass-border)]` +
  `rounded-[var(--radius-card)]`. Replace the current flat `border`
  treatment that reads as a wireframe.
- Buttons (shadcn `<Button>`): primary variant uses
  `bg-[var(--color-accent)] text-[var(--color-accent-fg)]`. Secondary
  uses `bg-[var(--color-surface)] hover:bg-[var(--color-surface-hi)]`.
- Top bar: keeps glass treatment (`bg-[var(--color-glass)]` +
  `backdrop-filter: blur(var(--blur-chrome))`). Works in both modes —
  glass tokens already differ per theme.

### Accent stays mauve, brand violet retires

The original `#7c5cff` violet from `.claude/rules/frontend.md` ("DO NOT
introduce a second accent") is retired in this slice. The accent rule
itself stays — one accent only — but the _value_ swaps to Catppuccin
mauve so light and dark modes can use the palette-native accent that
ships AA contrast in both directions. Update the rule block.

### Glass usage rules unchanged

Glass still only on chrome (top bar, dialogs, popovers, menus,
tooltips). Never on gallery cards. `prefers-reduced-transparency`
fallback path unchanged.

### Page container

Add a `<div class="mx-auto max-w-2xl">` wrapper around the
device/subscription form pages — the current edge-to-edge 1024 px
layout makes the form look barren. Gallery + run-list pages keep
their current width.

## State at start

- `src/app.css` exists with stale dark-first tokens (incomplete
  light-mode overrides — `--color-accent*` / `--color-ring` missing
  from `[data-theme="light"]` block).
- `src/app.html` hard-coded `data-theme="dark"`. No anti-FOUC.
- No theme toggle component, no theme store.
- shadcn `<Input>`, `<Textarea>`, `<Select>` use default chrome (no
  surface fill, sharp radius from shadcn defaults).
- Top bar (`src/lib/components/nav/TopBar.svelte` — confirm path
  during slice) has no theme toggle slot.
- `.claude/rules/frontend.md` §Theme token block is stale; needs
  rewrite to reflect this slice's locked palette.

## Resume here

1. Update `src/app.css` with the normative token blocks above. Keep
   the `body` + `@media (prefers-reduced-transparency)` blocks
   intact. Add `--radius` / `--radius-card` to `@theme`.
2. Update `src/app.html`:
   - Change `<html data-theme="dark">` → `<html data-theme="light">`.
   - Add inline `<script>` in `<head>` (BEFORE
     `%sveltekit.head%`) that: - Reads `localStorage.getItem('wallrus.theme')`. - If `'light'` / `'dark'`: apply directly. - If `'system'` or `null`: read `matchMedia('(prefers-color-
scheme: dark)').matches` → apply. - Wrap in try/catch (SSR / locked-down browsers).
3. Create `src/lib/stores/theme.ts`:
   - `type Theme = 'light' | 'dark' | 'system'`.
   - Reactive store (Svelte 5 rune-friendly — see
     `.claude/rules/frontend.md` "Persisted client prefs" pattern).
   - Setter writes localStorage + updates
     `document.documentElement.dataset.theme` (resolving `'system'`
     to the matchMedia result at write time).
   - Listener on `matchMedia` change: if current pref is `'system'`,
     re-apply.
4. Create `src/lib/components/ThemeToggle.svelte`:
   - Cycles `light → dark → system` on click.
   - Icon: `Sun` (light), `Moon` (dark), `Monitor` (system) from
     `lucide-svelte`.
   - `aria-label` reflects the current state.
5. Wire `<ThemeToggle>` into the top bar (path lives under
   `src/lib/components/nav/`; confirm during slice).
6. Audit shadcn primitives under `src/lib/components/ui/`:
   - `input/input.svelte` — add surface fill + new radius.
   - `textarea/textarea.svelte` — same.
   - `select/*` — same on the trigger.
   - `card/*` — bg-elev + new radius.
   - `button/button.svelte` — confirm primary/secondary use the new
     accent tokens; tweak Tailwind classes.
   - `dialog/dialog-content.svelte` — glass + new radius.
7. Audit form pages for fieldset chrome:
   - `src/routes/(app)/devices/new/+page.svelte`
   - `src/routes/(app)/devices/[slug]/edit/+page.svelte`
   - `src/routes/(app)/subscriptions/new/+page.svelte`
   - `src/routes/(app)/subscriptions/[id]/+page.svelte`
   - Wrap top-level form area in `<div class="mx-auto max-w-2xl">`
     if not already constrained.
8. Update `.claude/rules/frontend.md` §Theme section — replace the
   stale token block with the new normative palette.
9. Run all verification gates.
10. Commit + push, then mark slice done.

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green (theme store unit test new; component tests
      should still pass — only chrome classes changed)
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] `lefthook` pre-commit + commit-msg pass
- [ ] Manual smoke (reviewer or user): `bun run dev`, visit `/`,
      `/devices`, `/devices/new`, `/subscriptions`, `/runs` — confirm
      light is the default on first load, toggle cycles
      `light → dark → system`, no FOUC on hard refresh, all inputs
      have surface fill + medium radius, "Filter criteria" fieldset
      reads as a grouped card not a wireframe box.

## Done definition

```
feat(ui-theme): warm Catppuccin Mocha Latte + dark mode toggle
```

Body: token swap (light-primary Mocha Latte + dark Mocha), anti-FOUC
inline script, theme store + cycling toggle, shadcn chrome fills + 10/14
radius, fieldset card treatment, frontend rule updated. Co-author. Push.
Then `chore(plans): mark 014-ui-theme done`.

## Gotchas / Deferred

- shadcn-svelte components in `src/lib/components/ui/*` are
  copy-paste source — edits land in this repo, not a dependency. No
  upstream PR needed.
- Tailwind v4 CSS-first config: `@theme` block accepts the new
  `--radius*` tokens automatically (no `tailwind.config.js` to
  update). Use them via arbitrary value brackets in classes:
  `rounded-[var(--radius)]`.
- Glass token differences mean the top bar will need
  per-mode visual QA — what reads as "soft blur" in light may need
  border tweak in dark. Confirm during smoke.
- E2E (Playwright) coverage for the toggle is **deferred** — same
  Playwright bootstrap blocker as slices 011/012/013. Unit-test the
  store; visual confirmation via manual smoke.
- Docs site (`docs/`) does not include UI screenshots and does not
  need updating in this slice.
- Brand violet `#7c5cff` retires from the rule doc. If any future
  marketing site / OG image needs the old hex, fetch from git
  history.
