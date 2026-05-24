# wallrus user docs

Astro + Starlight site that publishes to GitHub Pages. Content lives under
`src/content/docs/en/` (English) and `src/content/docs/id/` (Bahasa).

## Local dev

```sh
cd docs
bun install
bun run dev
```

Open <http://localhost:4321/wallrus/>.

## Production build

```sh
bun run build
```

Output goes to `dist/`. The repo's `.github/workflows/deploy-docs.yml` builds
and pushes to GitHub Pages on every push to `main` that touches `docs/`.

## When to update this site

See `.claude/rules/user-docs.md`. Any user-visible change — env var, deployment
step, default config value, Docker compose toggle, install command — must be
reflected here in **both** locales in the same PR.
