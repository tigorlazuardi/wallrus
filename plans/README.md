# wallrus — implementation plans

Each subdirectory under `plans/` documents one **discrete slice of work** —
typically one feature, one refactor, or one bounded vertical (e.g. "HTTP
integration", "Reddit source", "auth implementation"). The folder is the unit
of context a future session feeds back to resume exactly where the previous
session stopped.

Automated execution: see [`RALPH.md`](./RALPH.md) for the Ralph Loop contract
and trigger commands.

## Folder convention

```
plans/<NNN>-<slug>/
├── IMPLEMENTATION.md    # narrative: goals, decisions, state, resume pointer
└── TASKS.md             # structured todo list for this slice
```

- `<NNN>` is a zero-padded three-digit ordinal. Slices are time-ordered, not
  topically grouped. New slice = `NNN+1`.
- `<slug>` is short kebab-case (`http-integration`, `reddit-source`,
  `auth`, …). Pick something a future reader recognizes at-a-glance.

## File contracts

### `IMPLEMENTATION.md`

Must contain, in this order:

1. **Status** — one line: `not-started` / `in-progress` / `blocked` / `done`.
2. **Goal** — what success looks like for this slice. Three sentences max.
3. **Decisions** — bullet list of choices baked in BEFORE the loop starts.
   Things the scope and architecture docs don't capture because they were
   implementation-time picks (library version pin, naming, edge case
   resolution). The loop must NOT relitigate these.
4. **State** — current snapshot. What is wired, what is stubbed, what is
   pending. Be specific (cite files, route paths, commit SHAs).
5. **Resume here** — the exact next step. A future session pastes this into
   the agent and continues without re-reading the rest.
6. **Verification gates** — the bun/eslint/prettier/lefthook + smoke commands
   that must pass before the closing commit.
7. **Done definition** — the closing commit message + push instruction.
8. **Gotchas / Deferred** — items the future agent should remember but not
   block on.

### `TASKS.md`

Plain Markdown task list with GitHub checkboxes:

- `- [ ]` not started
- `- [x]` done
- `- [~]` in progress (write the file you're touching)
- `- [-]` deferred / abandoned (write why)

Group with `##` headings per sub-area. Each task references a file path or
commit when relevant. Update the file as you finish work — `TASKS.md` is the
authoritative checklist for the slice.

## Rules

- **Never edit a slice marked `done`** without bumping it: cross out the line
  or open a new slice. Done slices are historical record.
- **One in-progress slice at a time** unless explicitly parallel-tracked.
- The slice's commits should reference the slice slug in the body
  (e.g. `feat(http-integration): wire …`) so the git log threads back.
- AI sessions: read the highest-numbered in-progress slice's
  `IMPLEMENTATION.md` first. The "Resume here" section is your starting line.
- **Push after every commit** — see `RALPH.md`.

## Index

| Slice                       | Status      | Goal                                                                              |
| --------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `001-foundation`            | done        | Scope locked, scaffold + schema + Docker + docs                                   |
| `002-http-integration`      | done        | Bun.serve hosting SvelteKit + scheduler tick + `/healthz`                         |
| `003-auth`                  | not-started | JWT cookie + Basic auth gate, login routes, rate-limited brute-force lockout      |
| `004-service-devices`       | not-started | Devices CRUD + toggle service, API routes, paginated list                         |
| `005-service-subscriptions` | not-started | Subscriptions CRUD + soft-delete + device link, cron validation, scheduler reload |
| `006-service-images`        | not-started | Images list/search/get/favorite/tag/delete/blacklist/restore + per-device images  |
| `007-source-reddit`         | not-started | Async-generator Reddit crawler with OAuth + gallery expansion                     |
| `008-source-booru`          | not-started | Danbooru + Gelbooru crawler with tag/rating filters                               |
| `009-ingest-pipeline`       | not-started | Scheduler executor: download, dedup, thumbnail, fan-out to devices                |
| `010-run-history`           | not-started | Run history list/get/active/SSE-stream API, prune-to-100 trigger                  |
| `011-webui-gallery`         | not-started | Masonry gallery, filter chips, infinite scroll, image modal, NSFW gate            |
| `012-webui-device`          | not-started | Device + subscription editor pages with superforms-driven flows                   |
| `013-webui-runs`            | not-started | Run dashboard with SSE live updates and per-subscription history                  |

Completion promise (last slice emits): `<promise>WALLRUS-MVP-COMPLETE</promise>`.
