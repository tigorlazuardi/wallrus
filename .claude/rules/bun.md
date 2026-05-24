---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "**/*.html"
  - "package.json"
  - "bun.lock"
  - "bunfig.toml"
---

# Bun stack rules

This project runs on **Bun**, not Node. Prefer Bun built-ins over npm equivalents.

## Commands

- Run a file: `bun <file>` (not `node` or `ts-node`).
- Install deps: `bun install` (not npm/yarn/pnpm).
- Run scripts: `bun run <script>`.
- One-off binaries: `bunx <pkg> <cmd>` (not npx).
- Build: `bun build <entry>` (not webpack or esbuild).
- Tests: `bun test` (not jest or vitest).
- Bun auto-loads `.env`. Do not add `dotenv`.

## APIs — prefer built-ins

| Need | Use | Don't use |
|------|-----|-----------|
| HTTP / WebSocket / HTTPS | `Bun.serve()` | `express`, `ws` |
| SQLite | `bun:sqlite` | `better-sqlite3` |
| Redis | `Bun.redis` | `ioredis` |
| Postgres | `Bun.sql` | `pg`, `postgres.js` |
| File I/O | `Bun.file` | `node:fs` `readFile`/`writeFile` |
| Shell exec | `` Bun.$`cmd` `` | `execa`, `child_process` |

## Testing

```ts
// index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

Run with `bun test`.

## Frontend (when relevant)

Use HTML imports with `Bun.serve()`. Do not introduce Vite.

```ts
// index.ts
import index from "./index.html";

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => new Response(JSON.stringify({ id: req.params.id })),
    },
  },
  websocket: {
    open: (ws) => ws.send("hello"),
    message: (ws, msg) => ws.send(msg),
    close: (ws) => {},
  },
  development: {
    hmr: true,
    console: true,
  },
});
```

HTML files import `.tsx` / `.jsx` / `.js` / `.css` directly; Bun's bundler transpiles and bundles.

```html
<!-- index.html -->
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

```tsx
// frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.body);
export default function Frontend() {
  return <h1>Hello, world!</h1>;
}
root.render(<Frontend />);
```

Run: `bun --hot ./index.ts`

> **Note**: wallrus uses **SvelteKit** for its WebUI, not raw HTML imports. The HTML-import path above is the Bun-native option; use it only when SvelteKit is not the right fit (e.g. a small standalone tool).

## Deep reference

Full Bun API docs live at `node_modules/bun-types/docs/**.mdx`.
