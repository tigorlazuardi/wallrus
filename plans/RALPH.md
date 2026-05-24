# Ralph Loop — wallrus build contract

This file is the **single prompt** the Ralph Loop plugin re-feeds every
iteration. The loop reads it, picks the next pending slice from `plans/`,
executes one bounded chunk of work, commits + pushes, and lets the
Stop hook re-fire the loop until the completion promise is emitted.

Plugin: <https://claude.com/plugins/ralph-loop>.

## Trigger commands

The recommended way is to point at this file so the loop instructions stay
in version control rather than scrolled-back chat history.

### One-line trigger (recommended)

```bash
/ralph-loop "Follow plans/RALPH.md verbatim. Execute the next pending slice in plans/<NNN>-<slug>/. Commit + push after each slice. Output <promise>WALLRUS-MVP-COMPLETE</promise> only when every slice in plans/README.md index is done." --completion-promise "WALLRUS-MVP-COMPLETE" --max-iterations 80
```

### Embed-the-contract trigger (alternative, more self-contained)

```bash
/ralph-loop "$(cat plans/RALPH.md)" --completion-promise "WALLRUS-MVP-COMPLETE" --max-iterations 80
```

### Single-slice trigger (useful for debugging)

```bash
/ralph-loop "Follow plans/RALPH.md but stop after slice 003-auth lands. Output <promise>SLICE-DONE</promise> when its TASKS.md is fully checked and the commit is pushed." --completion-promise "SLICE-DONE" --max-iterations 12
```

### Cancel

```bash
/cancel-ralph
```

## What the loop must do each iteration

1. **Read `plans/README.md`**. Find the lowest-numbered slice whose status is
   `not-started` or `in-progress`. That is **the slice**.
2. **Open `plans/<NNN>-<slug>/IMPLEMENTATION.md`**.
   - If `Status:` is `done` or `blocked`, skip to the next slice. (Blocked
     slices need human input — do **not** unblock by guessing.)
   - Otherwise, follow the **Resume here** section step-for-step.
3. **Work through `plans/<NNN>-<slug>/TASKS.md`** atomically:
   - `- [ ]` → `- [~]` when you start the task.
   - `- [~]` → `- [x]` when the task is verified.
   - Save the file after each transition so the next iteration sees state.
4. **Run the slice's Verification gates** (every slice lists the same
   baseline + slice-specific smoke). All gates green = ready to commit.
5. **Commit** using the message defined in the slice's "Done definition"
   section (Conventional Commits, slice slug in the scope).
6. **Push** immediately: `git push`. If push fails (remote moved), pull
   rebase and retry once. If still failing, mark slice `in-progress` and
   stop emitting the completion promise — let a human intervene.
7. **Mark the slice `done`** in `plans/<NNN>-<slug>/IMPLEMENTATION.md`
   (`Status: done`) and update the row in `plans/README.md` index table.
8. **Commit + push that bookkeeping** (`chore(plans): mark NNN-slug done`)
   so the loop's next iteration starts from a clean tree.
9. **If every slice in the index is `done`**, output the literal text
   `<promise>WALLRUS-MVP-COMPLETE</promise>` and stop.

## Hard rules

- **Never edit a slice already marked `done`.** Done = historical record.
  New work = new slice (`NNN+1`).
- **One slice per iteration ceiling.** If a slice is too big, commit
  progress (`- [~]` for the in-flight task), push, mark
  `Status: in-progress`, and exit. Next iteration resumes.
- **Never invent scope.** If a TASKS line is ambiguous, the slice's
  "Decisions" section is authoritative; otherwise consult
  `engineering/SCOPE.md`. Do **not** add features not listed.
- **Never bypass `lefthook`.** No `--no-verify`. If a hook fails, fix the
  cause; do not skip.
- **Stop if blocked.** If the same Verification gate fails 3 iterations in
  a row on the same line of code, set `Status: blocked` in the slice's
  IMPLEMENTATION.md with a one-paragraph reason, push, and exit **without**
  emitting the completion promise. A human will unblock and re-trigger.
- **Push after every commit.** The loop assumes work is durable on `origin`
  before the next iteration starts.

## Commit policy

- One Conventional Commit per coherent chunk. Typical slice = 1-3 commits.
- Scope = slice slug (e.g. `feat(auth): …`, `feat(ingest): …`).
- Co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- The slice's "Done definition" defines the **final** commit message
  (the one whose push closes the slice). Earlier WIP commits during the
  slice can use any Conventional message.

## Verification baseline (every slice)

These must pass before any commit:

- `bun run check` — svelte-check + tsc, zero errors.
- `bun test` — zero failures (test files under `./src` only, per
  `bunfig.toml`).
- `bunx eslint .` — zero **errors** (warnings on placeholder mixin
  scaffolds are acceptable until the relevant slice removes them).
- `bunx prettier --check .` — clean.
- `lefthook` pre-commit (gitleaks + format + lint + tsc + bun test) and
  commit-msg (commitlint) pass on real `git commit`.

Slice-specific smoke (curl, Playwright, manual run) is listed in the
slice's IMPLEMENTATION.md.

## Testing best practice (do these in every slice)

- **Unit tests** alongside the file under test (`foo.ts` →
  `foo.test.ts`), run by `bun test`. Cover happy path + the
  edge cases the Decisions section calls out.
- **Service mixins** (`src/lib/server/service/**`): test the operation
  via the service surface, not by reaching into the mixin. Mock the DB
  with an in-memory `bun:sqlite` instance running the same migrations.
- **API routes** (`src/routes/api/**`): test the `+server.ts` handler by
  importing it and calling with a constructed `Request`. Assert response
  shape against the slice's Zod schema.
- **Sources** (`src/lib/server/sources/**`): fixture-based. Capture a
  representative response JSON under `src/lib/server/sources/__fixtures__/`
  and assert the async generator yields the expected `SourceItem`s.
- **Playwright e2e**: extend `tests/e2e/smoke.spec.ts` only when a slice
  changes a user-visible route. Don't add e2e for backend-only slices.
- **No flakiness shortcuts.** No `test.skip`, no `--bail`, no time-based
  sleeps. Real assertions or none.

## File-touching budget

To keep iterations diff-reviewable:

- Prefer editing existing files over creating new ones. The directory
  layout is set in 001 — extend it, don't restructure it.
- A single iteration's diff should be **understandable in one read**.
  If a slice grows past ~600 changed lines, split it: commit what's
  green, mark `in-progress`, exit.

## When the loop is allowed to stop

Only two clean exits:

1. **Completion**: every slice in `plans/README.md` index is `done`.
   Output `<promise>WALLRUS-MVP-COMPLETE</promise>`.
2. **Blocked**: a slice is set `Status: blocked` and pushed. Do **not**
   emit the completion promise. The Stop hook will keep firing until
   `--max-iterations` is reached, which is the intended safety net.

Any other exit (give-up, "I think we're done", "this seems hard") is a
**violation** of the loop contract per
`commands/ralph-loop.md` — emit the completion promise **only when true**.

## Sanity checks before each iteration

Before doing anything, the loop should run (this is cheap and re-establishes
ground truth after a possible compaction):

```bash
git status
git log --oneline -5
ls plans/
```

Then proceed to "What the loop must do each iteration" step 1.
