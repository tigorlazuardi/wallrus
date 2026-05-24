---
paths:
  - "docs/**"
  - "src/lib/server/env.ts"
  - "Dockerfile"
  - "docker-compose.yml"
  - ".dockerignore"
  - ".github/workflows/deploy-docs.yml"
  - "engineering/ARCHITECTURE.md"
  - ".env"
  - ".env.*"
  - ".env.example"
---

# wallrus — user-facing docs rule

The user-facing documentation site lives at `docs/` (Astro Starlight, deployed
to GitHub Pages on every push to `main` that touches `docs/`). Anything the
operator of wallrus needs to know — env vars, Docker layout, install steps,
defaults, auth modes — is mirrored here in **both** English and Indonesian.

## When this rule fires

`paths:` triggers this rule whenever you touch any of:

- `docs/**` — the user docs themselves.
- `src/lib/server/env.ts` — the env source-of-truth. **Adding, removing, renaming, or changing the default of any env var requires touching `docs/src/content/docs/{en,id}/configuration/env.md` in the same change.**
- `Dockerfile`, `docker-compose.yml`, `.dockerignore` — Docker deployment surface. Changes here require updating `docs/src/content/docs/{en,id}/configuration/docker.md` and possibly `install.md`.
- `.github/workflows/deploy-docs.yml` — the docs deploy pipeline.
- `engineering/ARCHITECTURE.md` — §Deployment changes flow downstream into user docs.
- `.env*` files — examples or defaults the operator copies.

## What "in sync" means

Any user-visible change must propagate **before** the commit ships:

| Source change                                         | Must also touch                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| New env var                                           | Both locales of `configuration/env.md` — add a row, document the default, mark required/optional                                 |
| Removed env var                                       | Both locales of `configuration/env.md` — delete the row, plus any `install.md` snippet that uses it                              |
| Renamed env var                                       | Both locales of `configuration/env.md` and every `install.md` / `configuration/*.md` reference                                   |
| Default value change                                  | `configuration/env.md` (both locales). If user-visible behavior changed (e.g. auth toggle default), also `configuration/auth.md` |
| Dockerfile / compose change visible to operator       | `configuration/docker.md` (both locales). If install steps changed, also `install.md`                                            |
| New healthcheck / endpoint operator needs             | Affected `configuration/*.md` page (both locales)                                                                                |
| Auth flow change (cookie, JWT, Basic, login endpoint) | `configuration/auth.md` (both locales)                                                                                           |
| GitHub Pages workflow / deploy step change            | `docs/README.md` if developer-facing; otherwise just the workflow                                                                |

## Both locales, every time

`docs/src/content/docs/en/` and `docs/src/content/docs/id/` mirror each other.
Adding or editing an `.md` / `.mdx` page in one locale **must** be matched in
the other in the same commit. Do not ship a page that exists only in English
or only in Indonesian.

If you don't speak Indonesian comfortably, write a placeholder Indonesian
page with the same headings + a `> TODO: translate.` note inside, and open
the PR with a `needs-translation` label so a human can pick it up. Never
ship an English-only update.

## Translation style

- Match heading levels exactly across locales.
- Translate code-block comments where useful, but **never** rename env vars,
  flags, or paths in code blocks.
- Keep filename / URL / CLI invocations identical across both locales.
- Indonesian uses casual-formal mix matching the project owner's style
  ("kamu" not "anda", but no slang).

## Style and conventions

- Page-level frontmatter: `title` + `description`. Use short, factual
  descriptions — they go into search / opengraph.
- Pages live in flat directories: `en/`, `en/configuration/`, `id/`,
  `id/configuration/`. No deeper nesting without sidebar updates in
  `docs/astro.config.mjs`.
- Adding a new top-level page or section also requires a sidebar entry in
  `docs/astro.config.mjs` with a `translations.id` label.
- Internal links use **relative** paths (`./install/`, `../configuration/env/`)
  and end in a trailing slash (Starlight's default).
- External links use absolute URLs.
- Use Starlight components (`<Tabs>`, `<Card>`, `<CardGrid>`, `<Aside>`) when
  they aid comprehension; don't decorate for the sake of decoration.

## Local preview

```sh
cd docs
bun install
bun run dev
```

Open <http://localhost:4321/wallrus/>.

## Out of scope

The user docs do **not** cover:

- Technical architecture, schema, pipeline, scheduler internals → those live
  in `engineering/ARCHITECTURE.md` (contributor reference).
- AI-agent guidance → `.claude/rules/*.md`.
- Scope decisions and post-MVP plans → `engineering/SCOPE.md`.

If you find yourself documenting internals in `docs/`, move the content to
`engineering/` instead.

## Don't

- Don't change an env name / default / auth flow without updating both locales.
- Don't ship a Dockerfile / compose change without updating `configuration/docker.md` in both locales.
- Don't ship single-locale pages.
- Don't paste internal-architecture content into the user docs — point to
  `engineering/` from the contributor README instead.
- Don't break the sidebar order in `astro.config.mjs` without intent — readers
  rely on it as a course.
