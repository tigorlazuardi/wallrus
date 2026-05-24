# Builder notes — `<NNN>-<slug>`

> Copy this file into the slice folder as `.builder-notes.md` on the
> first builder invocation that needs to persist a non-obvious decision
> or observation for the next invocation. **Do not commit a blank
> notes file** — only add this file when there's actual content to
> hand off. The reviewer reads this file between invocations.
>
> Append-only convention: newest entries at the bottom. Each entry is
> dated + invocation-tagged.

## Decisions reaffirmed (deviating from IMPLEMENTATION.md, if any)

<!-- e.g. "Used `Bun.password.hash` instead of bcryptjs — Decisions
already named argon2id via Bun, just confirming the call site." -->

## Gotchas hit this slice

<!-- e.g. "svelte-check choked on `event.locals.runtime` without an
import. Added `import type { Runtime } from '$lib/server/runtime'`
to app.d.ts." -->

## Files in-flight at end of invocation N (if handing off)

<!-- e.g.
- `src/lib/server/scheduler/cron.ts` — `start()` written, `tick()`
  shell exists but no `nextRun()` evaluation yet.
- `src/lib/server/scheduler/cron.test.ts` — empty file, planning
  fake-Date.now test next.
-->

## Test fixtures captured

<!-- e.g. "Saved Reddit gallery response to
`src/lib/server/sources/__fixtures__/reddit_gallery_4items.json`." -->

## Open questions for the reviewer

<!-- e.g. "ARCHITECTURE.md §Scheduler says 30s tick but Decisions in
IMPLEMENTATION.md say 60s. Went with 60s per Decisions; reviewer
should reconcile ARCHITECTURE.md or push back." -->

---

## Entry log

<!-- Append each invocation's summary here. Format:

### invocation N — YYYY-MM-DD HH:MM

- Did: …
- Status: complete | handoff | got-stuck
- Next: …
-->
