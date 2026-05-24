# Ralph Loop — wallrus build contract

This file is the **single prompt** the Ralph Loop plugin re-feeds every
iteration. The loop runs in the main session (Opus, the **reviewer**)
and delegates the heavy lifting to a Sonnet subagent (the **builder**,
`wallrus-builder`) per slice. Opus reviews the builder's diff,
re-runs gates, commits, pushes, and lets the Stop hook re-fire the
loop until the completion promise is emitted.

Plugin: <https://claude.com/plugins/ralph-loop>.

## Roles

| Role         | Model  | Job                                                                                                                               |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Reviewer** | Opus   | Runs the loop. Spawns one `wallrus-builder` per slice. Reviews diffs. Re-runs verification gates. Commits + pushes. Marks `done`. |
| **Builder**  | Sonnet | Subagent (`.claude/agents/wallrus-builder.md`). Reads the slice, edits files, runs tests. Does NOT commit/push/edit plan status.  |

Why split: per-slice cost drops ~70-80% vs pure Opus while preserving a
review layer. The builder definition pins `model: sonnet` and forbids git
write operations.

**Important**: Start the ralph loop from an Opus session. The loop fires
the Stop hook on the _main_ session — whoever's driving the main session
is the reviewer. If you `/model sonnet` and then `/ralph-loop`, you lose
the review layer.

## Pre-flight (read before the first /ralph-loop run)

The `wallrus-builder` subagent is defined in
`.claude/agents/wallrus-builder.md`. Claude Code's agent registry
**scans this directory only at session start**. If the file was added
or edited during the current session, the registry does NOT see it —
`Agent({ subagent_type: "wallrus-builder" })` will fail with
`agent type not found`.

**Before triggering `/ralph-loop` for the first time** (or after any
edit to `.claude/agents/wallrus-builder.md`):

1. Exit Claude Code (`Ctrl+C` twice or `/exit`).
2. Re-open Claude Code from the same project directory.
3. Confirm registration: `/agents` should list `wallrus-builder`.
4. Then run the trigger command.

Skipping the restart wastes iterations and burns Opus tokens — the
reviewer cannot spawn the builder and the loop spins on the same
blocker until you `/cancel-ralph`. (See also the fallback in the Hard
rules section.)

## Trigger commands

The recommended way is to point at this file so the loop instructions stay
in version control rather than scrolled-back chat history.

### One-line trigger (recommended)

```bash
/ralph-loop "Follow plans/RALPH.md verbatim. You are the REVIEWER (Opus). Each iteration: identify the next pending slice in plans/<NNN>-<slug>/, spawn the wallrus-builder subagent to implement it, review the resulting diff + re-run verification gates, then commit + push. Output <promise>WALLRUS-MVP-COMPLETE</promise> only when every slice in plans/README.md index is done." --completion-promise "WALLRUS-MVP-COMPLETE" --max-iterations 80
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

(All steps are performed by the **reviewer** — Opus, the main session —
unless tagged `[builder]`.)

1. **Sanity check**: run `git status`, `git log --oneline -5`, `ls plans/`.
   Confirm clean tree and `origin/main` parity.
2. **Pick the slice**: read `plans/README.md`. Find the lowest-numbered
   slice whose status is `not-started` or `in-progress`. That is **the
   slice**. If `Status: blocked`, do not unblock — emit no completion
   promise, let `--max-iterations` clamp.
3. **Read the slice index**: open `plans/<NNN>-<slug>/IMPLEMENTATION.md`.
   Confirm its `Decisions` haven't changed since last iteration (if you
   ran an iteration that ended `in-progress`).
4. **Spawn the builder** `[builder]` via the Task tool:
   - `subagent_type: "wallrus-builder"`
   - `description`: `"Implement slice <NNN>-<slug>"`
   - `prompt`: a self-contained brief that:
     - Names the slice path: `plans/<NNN>-<slug>/`.
     - Tells the builder to read `IMPLEMENTATION.md` + `TASKS.md` +
       `.builder-notes.md` (if present) end-to-end.
     - **Names the scope crisply** — which "Resume here" steps the
       builder should attempt this invocation. Default = "all
       unfinished steps". For slices with ≥6 Resume steps OR ≥4
       service operations OR ≥5 new files, **split the slice across
       2-3 builder invocations** (e.g. "steps 1-3 this invocation;
       reviewer will spawn you again for 4-6"). Smaller invocations
       = lower compaction risk = less halu.
     - Reminds the builder of the hard prohibitions (no commit, no push,
       no plan-status edits).
     - Asks for the structured report format described in
       `.claude/agents/wallrus-builder.md`.

### Recommended slice → invocation split (rule of thumb)

| Slice                     | Suggested invocations | Why                                                                                    |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| 002-http-integration      | 2                     | (env+queue+scheduler) → (cli+hooks+healthz+smoke)                                      |
| 003-auth                  | 2                     | (env+jwt+cookie+basic+password+rate-limit) → (hooks+routes+page+tests)                 |
| 004-service-devices       | 2                     | (helpers+schemas+service) → (routes+tests+smoke)                                       |
| 005-service-subscriptions | 2                     | (registry+scheduler reload+schemas+service) → (routes+tests)                           |
| 006-service-images        | 2                     | (schemas+service) → (routes+tests+FTS smoke)                                           |
| 007-source-reddit         | 1                     | Single source module, scope fits one invocation                                        |
| 008-source-booru          | 1                     | Same                                                                                   |
| 009-ingest-pipeline       | 3                     | (migration+filters+fs+dedup) → (pipeline+scheduler hook) → (integration tests+smoke)   |
| 010-run-history           | 2                     | (migration+bus+update+services) → (routes+SSE tests)                                   |
| 011-webui-gallery         | 2                     | (route group+layout+components) → (page+thumbnail+file endpoints+tests)                |
| 012-webui-device          | 2                     | (sources endpoint+reusable components+device pages) → (subscription pages+forms+tests) |
| 013-webui-runs            | 1                     | Small slice, fits one                                                                  |

5. **Review the builder's report + diff** (also: halu detection):
   - `git status` and `git diff --stat HEAD` — ground truth.
   - **Halu check**: for every file the builder claimed to edit, confirm
     it appears in `git diff --stat`. If it doesn't, the builder
     hallucinated the edit — re-spawn with explicit correction citing
     the missing change.
   - Spot-check the most-touched files via Read. Confirm the actual code
     matches what was promised (right symbols, right imports, no
     placeholder TODOs). **Read-only** — never `Edit`/`Write` source.
   - Re-run the slice's "Verification gates" yourself
     (`bun run check`, `bun test`, `bunx eslint .`, `bunx prettier --check .`,
     slice-specific smoke). All read-only commands. Do not trust the
     builder's claim alone.
   - If gates fail: **always** spawn a fresh `wallrus-builder` in
     FIX-MODE with the exact gate output pasted in the prompt. The
     reviewer NEVER edits source — not even typos, not even a single
     `bunx prettier --write` pass. See §Fix-mode invocation below.
   - If multiple invocations are needed (per the split table), repeat
     step 4 with a new prompt: "steps 1-3 done per TASKS.md; do steps
     4-6 now." The builder reads TASKS.md state + .builder-notes.md and
     continues without re-doing work.
6. **Commit** using the slice's "Done definition" message
   (Conventional Commits, slice slug in the scope, Claude co-author
   trailer). Single closing commit per slice — squash interim builder
   output if needed via `git add` granularity.
7. **Push**: `git push`. On reject, `git pull --rebase` once and retry.
   If still failing, set the slice `Status: in-progress`, push the
   bookkeeping, exit **without** the completion promise.
8. **Mark done**: edit the slice's IMPLEMENTATION.md (`Status: done`) and
   the row in `plans/README.md` index.
9. **Bookkeeping commit + push**: `chore(plans): mark <NNN>-<slug> done`.
10. **If every slice in the index is `done`**: output the literal text
    `<promise>WALLRUS-MVP-COMPLETE</promise>` and stop.

## Hard rules (reviewer)

- **Reviewer NEVER touches code.** No `Edit` or `Write` on anything
  under `src/`, `drizzle/`, `engineering/`, `docs/`, `tests/`,
  `lefthook.yml`, `package.json`, `bun.lock`, `tsconfig*.json`,
  `eslint.config.*`, `.prettierrc*`, `svelte.config.js`,
  `vite.config.*`, `tailwind.config.*`, `commitlint.config.*`, or
  any first-party source file. Allowed reviewer writes are limited to:
  - `plans/<NNN>-*/IMPLEMENTATION.md` `Status:` field (one-line edit).
  - `plans/README.md` index status column (one-line edit).
  - Git commit messages (via `git commit -m`).
    Everything else — typos, format passes, lint fixes, broken tests,
    one-character regressions, a missing semicolon — is delegated to a
    fresh `wallrus-builder` invocation. **Reason**: Opus implementer
    time burns the user's quota; Sonnet builder cost is ~5× cheaper
    per token and the user has explicitly forbidden Opus implementations.
- **Fix-mode is also delegated.** If verification gates fail, do NOT
  fix locally. Spawn another `wallrus-builder` with a FIX-MODE prompt
  (see §Fix-mode invocation). The reviewer's only responsibility on
  failure is to read the failure output, choose the right prompt,
  re-spawn, and re-verify when the builder reports back.
- **Never edit a slice already marked `done`.** Done = historical record.
  New work = new slice (`NNN+1`).
- **One slice per iteration ceiling.** If the builder can't finish a
  slice in one invocation (or two splits), commit the builder's progress
  (preserving `- [~]` markers in TASKS.md), push, mark
  `Status: in-progress`, exit. Next iteration resumes.
- **Never invent scope.** If the builder reports ambiguity, consult the
  slice's `Decisions` first, then `engineering/SCOPE.md`. Do not add
  features not listed.
- **Never bypass `lefthook`.** No `--no-verify`. If a hook fails, fix the
  cause; do not skip.
- **Stop if blocked.** If the same Verification gate fails 3 iterations in
  a row on the same line of code, set `Status: blocked` in the slice's
  IMPLEMENTATION.md with a one-paragraph reason, push, and exit
  **without** emitting the completion promise. A human will unblock and
  re-trigger.
- **Push after every commit.** The loop assumes work is durable on
  `origin` before the next iteration starts.
- **Trust but verify the builder.** Always re-run gates locally — the
  builder's report describes intent, the gate output describes truth.
- **Builder unavailable → halt loop, do NOT improvise.** If
  `Agent({ subagent_type: "wallrus-builder" })` returns
  `agent type not found`, the registry didn't pick up
  `.claude/agents/wallrus-builder.md` (typically: agent file added or
  edited mid-session — see §Pre-flight). Do NOT fall back to
  `general-purpose` + `model: sonnet` to "keep the loop moving" — that
  bypasses the agent's hard prohibitions (no git writes, no plan
  status edits) and a misbehaving fallback can corrupt plan state. Do
  NOT implement the slice yourself (reviewer-never-touches-code stands).
  Action:
  1. State the blocker plainly in the iteration output.
  2. Do NOT emit the completion promise (it would be false).
  3. Do NOT commit any bookkeeping.
  4. Ask the user to `/cancel-ralph`, restart Claude Code, then
     re-trigger the loop. The tree stays at the last good commit.

## Hard rules (builder — enforced by `.claude/agents/wallrus-builder.md`)

- No `git commit`, no `git push`, no `--no-verify`.
- No edits to `plans/<NNN>-*/IMPLEMENTATION.md` `Status:` field.
- No edits to `plans/README.md` index status column.
- No new slices, no `plans/` restructure.
- No marking a TASKS line `[x]` unless the verification it implies passes.
- No silent design overrides — if Decisions conflict, STOP and report.

## Fix-mode invocation (when a verification gate fails)

Reviewer never fixes code. Every fix is a fresh `wallrus-builder`
invocation. Use this template:

```
You are resuming slice <NNN>-<slug> in FIX-MODE. The previous
invocation landed file changes but a verification gate failed.

GATE: <bun run check | bun test | bunx eslint . | bunx prettier --check . | <smoke command>>
EXACT OUTPUT:
<paste 10-40 relevant lines verbatim — TypeScript errors with
file:line, failing test name + assertion message, eslint rule +
file:line, prettier diff, smoke command stderr — whichever applies>

What to do:
1. Read TASKS.md and .builder-notes.md to ground-truth current state.
2. Run `git status` and `git diff --stat HEAD` so you see what the
   previous invocation actually wrote.
3. Diagnose the failure from the pasted output. Do NOT redo prior
   work — just fix the regression named by the gate.
4. Apply the smallest fix that makes the gate green.
5. Re-run the failing gate locally until it passes.
6. Re-run ALL gates (check, test, eslint, prettier, slice smoke) to
   confirm no new regression was introduced.
7. Report back with the standard report format from
   .claude/agents/wallrus-builder.md.

Hard rules unchanged: do NOT `git commit`. Do NOT `git push`. Do NOT
`--no-verify`. Do NOT edit IMPLEMENTATION.md Status or
plans/README.md.
```

**Fix-mode quota guard**: if the same gate fails 3 FIX-MODE
invocations in a row on the same slice, set the slice `Status: blocked`
with reason "fix-mode budget exceeded — likely a Decision conflict or
underspecified gate", push the bookkeeping, exit **without** the
completion promise. (Same exit semantics as the main blocked path.)

## Compaction defense — proactive HANDOFF protocol

Sonnet subagent contexts can auto-compact mid-invocation, which risks
hallucination as detail is summarized away. The defense is to **never let
compaction happen** — the builder self-monitors and emits a structured
HANDOFF report BEFORE the limit is hit, so the reviewer can spawn a
fresh builder with the HANDOFF embedded in the new prompt.

### Defenses layered (low → high reliability)

1. **Small invocations.** See the split table above. Smaller scope =
   fewer tokens burned = no handoff needed.
2. **TASKS.md is the checkpoint.** Each builder invocation reads it
   first. `- [~]` markers tell the next invocation exactly where to
   resume.
3. **`.builder-notes.md` per slice.** Design decisions / blockers /
   observations the next invocation needs but TASKS.md can't carry.
4. **Builder self-monitor** (`.claude/agents/wallrus-builder.md` §
   "Surviving compaction — proactive HANDOFF"). Triggers HANDOFF on:
   ≥25 tool calls, ≥15 file reads, system-reminder mentioning
   compaction, summarized-looking responses, or sub-area boundary.
5. **HANDOFF report format** is structured (yaml-ish block ending the
   message). Contains `stopped_at`, `last_action`, `in_flight`,
   `tasks_md_state`, `key_observations`, and
   `recommended_next_prompt` (paste-ready).
6. **Reviewer forwards HANDOFF** verbatim in the next builder spawn:

   ```
   The previous invocation handed off. Here is the HANDOFF block in full:

   <paste HANDOFF verbatim>

   Read .builder-notes.md and TASKS.md before doing anything. Run
   `git status` and `git diff --stat HEAD` to verify on-disk state
   matches the HANDOFF. Then resume.
   ```

7. **Reviewer halu check.** Always ground-truth the builder's claims via
   `git diff --stat HEAD` and Read before committing.

### Reviewer actions when builder returns a HANDOFF

1. Parse the HANDOFF block from the builder's final message.
2. Read `.builder-notes.md` + last few lines of `TASKS.md` to confirm
   the HANDOFF is consistent with disk.
3. `git status` and `git diff --stat HEAD` — verify `in_flight` files
   are actually modified, files claimed `[x]` actually have the
   expected changes.
4. If mismatch: trust disk, correct the next prompt accordingly.
5. Do **not** commit unless the slice is complete (HANDOFF means
   in-progress — leave the tree dirty, the next invocation continues).
   Exception: if the in-flight files are coherent and at a stable
   checkpoint, you MAY commit a `wip(<slug>): partial — handoff at
step N` to checkpoint to remote before the next invocation, then
   the next invocation amends or follows up. Default: don't commit on
   HANDOFF, just push the next invocation.
6. Spawn a fresh `wallrus-builder` with the new prompt as described in
   defense #6 above.
7. **Loop quota guard**: if a single slice triggers ≥ 4 HANDOFFs in a
   row, set the slice `Status: blocked` with reason "exceeded handoff
   budget — slice likely too large or under-specified", push the
   bookkeeping, exit **without** the completion promise. A human
   will split the slice into smaller follow-up slices.

## Commit policy

- One Conventional Commit per coherent chunk. Typical slice = 1 closing
  commit (`feat(<slug>): …`) plus an optional WIP commit if the slice
  splits across iterations.
- Scope = slice slug (e.g. `feat(auth): …`, `feat(ingest): …`).
- Co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- The slice's "Done definition" defines the **final** commit message.

## Verification baseline (every slice)

These must pass before any commit:

- `bun run check` — svelte-check + tsc, zero errors.
- `bun test` — zero failures.
- `bunx eslint .` — zero **errors** (warnings on placeholder mixin
  scaffolds are acceptable until the relevant slice removes them).
- `bunx prettier --check .` — clean.
- `lefthook` pre-commit (gitleaks + format + lint + tsc + bun test) and
  commit-msg (commitlint) pass on real `git commit`.

Slice-specific smoke (curl, Playwright, manual run) is listed in the
slice's IMPLEMENTATION.md.

## Testing best practice (the builder enforces these per slice)

- **Unit tests** alongside the file under test (`foo.ts` → `foo.test.ts`),
  run by `bun test`.
- **Service mixins**: test via the service surface, not into the mixin.
  Mock DB with an in-memory `bun:sqlite` instance running the same
  migrations.
- **API routes**: import the `+server.ts` handler and call with a
  constructed `Request`. Assert response shape against the slice's Zod
  schema.
- **Sources**: fixture-based. Capture a representative response JSON
  under `src/lib/server/sources/__fixtures__/` and assert the async
  generator yields the expected `SourceItem`s.
- **Playwright e2e**: extend `tests/e2e/smoke.spec.ts` only when a slice
  changes a user-visible route.
- **No flakiness shortcuts.** No `test.skip`, no `--bail`, no time-based
  sleeps.

## File-touching budget

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
**violation** of the loop contract per `commands/ralph-loop.md` — emit
the completion promise **only when true**.

## Sanity checks before each iteration

Before doing anything, the reviewer runs (cheap, re-establishes ground
truth after possible compaction):

```bash
git status
git log --oneline -5
ls plans/
```

Then proceeds to "What the loop must do each iteration" step 2.
