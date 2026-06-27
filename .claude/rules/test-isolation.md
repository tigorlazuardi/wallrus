---
paths:
  - "**/*.test.ts"
---

# Test isolation — no leaked global state across files

`bun test` runs every test file in **one process**. Any global a test file mutates
stays mutated for every file that runs afterward. File execution order is the
filesystem's, which **differs between machines** — so a leak passes locally and
fails in CI (or vice-versa), looking like a phantom flake. A whole class of these
already cost us 68 CI-only failures (auth test poisoned `apiFetch` for every
later hook test). Rules below are non-negotiable.

## `mock.module()` — never auto-restores. You MUST neutralize it.

- `mock.module(path, factory)` is **process-global and permanent**. Per bun docs,
  **`mock.restore()` does NOT undo it** — there is no un-mock. Once a file mocks a
  shared module, every later file gets that mock.
- A test file that `mock.module()`s a module imported by **other** files MUST make
  the mock **benign once its own tests finish**. The pattern: capture the real
  module first, then delegate to it by default and intercept only inside this
  file's tests via an override that an `afterEach` clears.

  ```ts
  import * as realFetcher from "$lib/client/fetcher" // hoisted — binds the REAL module
  const realApiFetch = realFetcher.apiFetch

  let _override: (() => Promise<Response>) | null = null

  mock.module("$lib/client/fetcher", () => ({
    ...realFetcher, // keep other exports intact
    apiFetch: (path: string, init?: RequestInit) =>
      _override ? _override() : realApiFetch(path, init),
  }))

  afterEach(() => {
    _override = null // after this file's tests, the mock == real behavior
  })
  ```

- Mocking a module that **no other file imports** (a pure leaf) is lower-risk, but
  still prefer the delegate-or-clear shape so a future importer doesn't get bitten.

## `globalThis.fetch` (and any global) — install in `beforeEach`, restore in `afterEach`

- Do **not** overwrite `globalThis.fetch` once at module load and walk away. Capture
  the real value, install your wrapper, and restore the real value in `afterEach`:

  ```ts
  const realFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = myStub
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })
  ```

- An unstubbed call should **throw loudly** (`throw new Error("unexpected fetch: " + url)`),
  not silently hit the real network or fall through to another file's stub. Silent
  fall-through is exactly how a stale reject leaks into an unrelated test.

## Self-check before committing a test file

- Did I `mock.module` / overwrite `globalThis.*` / set a singleton? → is it restored
  or made benign in `afterEach`/`afterAll`?
- Would my file still pass if it ran **first** in the suite? Verify:
  `bun test path/to/my.test.ts path/to/some-other-hook.test.ts` (mine first) → 0 fail.
