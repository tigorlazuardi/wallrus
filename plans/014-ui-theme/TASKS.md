# 014 — UI theme — tasks

## Tokens + HTML shell

- [x] `src/app.css` — replace `@theme` + `:root` blocks with the normative palette in IMPLEMENTATION.md §Decisions
- [x] `src/app.css` — add `--radius: 10px` + `--radius-card: 14px` (and `--blur-chrome` if not already in `@theme`)
- [x] `src/app.css` — keep `body` rules and `@media (prefers-reduced-transparency)` block intact
- [x] `src/app.html` — `<html data-theme="dark">` → `<html data-theme="light">`
- [x] `src/app.html` — inline anti-FOUC `<script>` in `<head>` BEFORE `%sveltekit.head%` (localStorage → matchMedia → apply, wrapped in try/catch)
- [x] `src/app.html` — `<meta name="color-scheme" content="light dark">` (flip order so light is primary)

## Theme store + toggle

- [x] `src/lib/stores/theme.ts` — typed store `'light' | 'dark' | 'system'`, localStorage key `wallrus.theme`
- [x] Store setter writes localStorage + updates `document.documentElement.dataset.theme` (resolving `'system'` to matchMedia at write time)
- [x] `matchMedia` change listener re-applies when current pref is `'system'`
- [x] `src/lib/stores/theme.test.ts` — unit test for cycle, persistence, system resolution
- [x] `src/lib/components/ThemeToggle.svelte` — cycles `light → dark → system`, lucide icons (`Sun` / `Moon` / `Monitor`), `aria-label` reflects current state
- [x] Wire `<ThemeToggle>` into top bar (wired into `src/routes/(app)/+layout.svelte` — no TopBar.svelte exists, top bar is inline in layout)

## shadcn primitives chrome

- [x] `src/lib/components/ui/input/Input.svelte` — `bg-[var(--color-surface)]`, `rounded-[var(--radius)]`, border → `border-[var(--color-glass-border)]`
- [x] `src/lib/components/ui/textarea/Textarea.svelte` — same treatment
- [x] `src/lib/components/ui/select/SelectTrigger.svelte` — trigger gets same treatment
- [x] `src/lib/components/ui/card/Card.svelte` — already correct; verified `bg-[var(--color-bg-elev)]`, `border-[var(--color-glass-border)]`, `rounded-[var(--radius-card)]`
- [x] `src/lib/components/ui/button/Button.svelte` — already correct; verified primary uses `bg-[var(--color-accent)] text-[var(--color-accent-fg)]`
- [x] `src/lib/components/ui/dialog/DialogContent.svelte` — already correct; verified glass + `rounded-[var(--radius-card)]`
- [x] `src/lib/components/ui/badge`, `alert`, `switch`, `checkbox`, `radio-group`, `slider`, `toggle` — fixed all stale `var(--accent)` / `var(--ring)` / `var(--surface*)` references to `var(--color-*)` prefix

## Form page wrappers

- [x] `src/routes/(app)/devices/new/+page.svelte` — already has `max-w-2xl`; fixed old var names; upgraded filter criteria container to `bg-[var(--color-bg-elev)]` + `rounded-[var(--radius-card)]`
- [x] `src/routes/(app)/devices/[slug]/edit/+page.svelte` — same
- [x] `src/routes/(app)/subscriptions/new/+page.svelte` — already has `max-w-2xl`; fixed old var names
- [x] `src/routes/(app)/subscriptions/[id]/+page.svelte` — already has `max-w-2xl`; fixed old var names; upgraded info cards to `bg-[var(--color-bg-elev)]`

## Rule docs

- [x] `.claude/rules/frontend.md` §Theme — replaced stale dark-first token block with locked Mocha Latte + Mocha palette; noted light is primary, accent now mauve `#8839ef`/`#cba6f7`; updated theme toggle docs

## Verification gates

- [x] `bun run check` clean (0 errors, 3 pre-existing warnings)
- [x] `bun test` green (695 pass, 0 fail)
- [x] `bunx eslint .` zero errors (1 pre-existing warning in base.ts)
- [x] `bunx prettier --check .` clean
- [ ] Manual smoke: light is default, toggle cycles, no FOUC on hard refresh, inputs filled + radius medium, fieldset reads as grouped card
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(ui-theme): warm Catppuccin Mocha Latte + dark mode toggle`
- [ ] Co-author trailer + push
- [ ] `Status: done` in IMPLEMENTATION.md
- [ ] README index updated with row for `014-ui-theme`
- [ ] `chore(plans): mark 014-ui-theme done` committed + pushed
