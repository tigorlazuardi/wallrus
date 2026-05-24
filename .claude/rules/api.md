---
paths:
  - "src/routes/api/**"
  - "src/hooks.server.ts"
  - "src/routes/auth/**"
  - "src/routes/**/+server.ts"
---

# wallrus — API & HTTP rules

Full detail in [`engineering/ARCHITECTURE.md`](../../engineering/ARCHITECTURE.md) §HTTP routing and §Frontend §Listing & pagination contract. This rule restates the enforceable conventions.

## API surface

- All endpoints under `/api/v1/*`. Versioned from day 1.
- All handlers are **thin wrappers** — parse input with Zod, call a service, shape the response. No business logic.
- Body / query validation **always at the route layer** via Zod. Services trust their inputs.

### Two write paths, one schema

- **WebUI forms** go through SvelteKit **form actions** with **`sveltekit-superforms`** (`dataType: 'json'`). See [`frontend.md`](./frontend.md) §Forms.
- **API endpoints** (`/api/v1/*`) take **plain JSON** via `request.json()` + `Schema.parse()`.
- Both paths consume the SAME Zod schema from `$lib/schemas/<domain>/<Op>.ts` and call the SAME service method. No drift, no duplicate validators.

## Auth gate (in `hooks.server.ts`)

- Every request runs through `hooks.server.ts` for a per-request telemetry span and the auth gate.
- **If `WALLRUS_AUTH_ENABLE=false`**:
  - Skip the entire gate. All routes public.
  - `GET /auth/login` → 404 (or redirect `/`).
  - `POST /api/v1/auth/login` → `410 Gone`, body `{ error: "auth_disabled" }`.
  - Single startup warning emitted in the boot log so the choice is visible.
- **Else (auth enabled)**:
  - `/api/v1/auth/login` → unauthenticated. POST `{ username, password }` validates against env, returns `{ access_token, expires_at }`.
  - `/api/v1/*` (everything else) accepts ANY of: Bearer JWT / Basic / `auth_session` cookie. 401 otherwise.
  - `/auth/login` (HTML form) → unauthenticated; POST validates → sets cookie.
  - `/auth/logout` → clears cookie.
  - Everything else under `/` → require `auth_session` cookie; redirect to `/auth/login` if missing.

### Credentials

- Env (required when auth enabled): `WALLRUS_USERNAME`, `WALLRUS_PASSWORD`, **`WALLRUS_AUTH_SECRET`** (≥32 bytes entropy). Missing or short → **bootstrap fail-fast**, no auto-derive.
- Env (optional): `WALLRUS_JWT_TTL_DAYS` (default 30), `WALLRUS_TRUST_PROXY` (default false).
- Shared `auth_secret` used for BOTH cookie HMAC and JWT signing. Domain-separated:
  - Cookie HMAC: `HMAC-SHA256(auth_secret, "wallrus-cookie-v1:" + username + ":" + password)`.
  - JWT signing: `auth_secret` directly, HS256 via `jose`. Payload: `{ sub: "wallrus", iat, exp }`.
- All credential comparisons use `crypto.timingSafeEqual` over equal-length buffers. Username and password compared separately.
- Cookie attributes: `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=30d`, `Secure` when scheme is https (or trusted proxy says so).

### Rate limit

In-memory token bucket on `/auth/login`, `/api/v1/auth/login`, and any 401 reply: ~5 attempts / minute / source IP. Resets on success. Pure in-memory; lost on restart (fine).

### Logging redaction

Telemetry must redact `Authorization`, `Cookie`, and POST bodies on `/auth/login` + `/api/v1/auth/login`. 401 responses are generic (`{ error: "invalid_credentials" }`) — no echo of submitted values.

## Listing & pagination contract

**Every list endpoint shares one contract.**

### Query inputs

```ts
type ListQuery = {
  next?: string // UUIDv7 — anchor: results AFTER this row
  prev?: string // UUIDv7 — anchor: results BEFORE this row
  offset?: number // default 0; additional rows to skip past the anchor (or from start if no cursor)
  limit?: number // default 60; capped at 200
  // plus per-endpoint filter params (source, device, tag, q, …)
}
```

- `next` and `prev` are **mutually exclusive**. If both are present, **`next` wins**.
- `offset` layers on top of any cursor (rare; mostly used by jump-to-page-N from a non-adjacent state).
- **Page 1 is always cursor-less** (no `next`, no `prev`, `offset=0`). The UI rebuilds page 1 fresh.

### Response shape

```ts
type ListResponse<T> = {
  items: T[] // up to `limit` items, in sort order
  total: number // total row count under current filter
  next_cursor?: string // id of last item in `items` (for "→")
  prev_cursor?: string // id of first item in `items` (for "←")
}
```

`total` is a separate `COUNT(*)` query under the same filter. Acceptable cost at MVP scale.

### Deterministic ordering — invariant

**Every list query MUST end with `, id ASC` (or `, id DESC` to match direction)** as the final tie-breaker. UUIDv7 is sortable; `(primary_sort_col, id)` gives a stable total order that survives mutations during paging. For most endpoints the primary sort is `(<created_at_or_ingested_at> DESC, id DESC)`. Gallery uses `(ingested_at DESC, id DESC)`.

### Compound-cursor seek pattern

```sql
-- forward (next) — primary sort DESC
SELECT … FROM images
WHERE <filter>
  AND (ingested_at, id) < (SELECT ingested_at, id FROM images WHERE id = ?)
ORDER BY ingested_at DESC, id DESC
LIMIT ? OFFSET ?

-- backward (prev) — flip predicate, ORDER ASC, then re-reverse the slice in service
SELECT … FROM images
WHERE <filter>
  AND (ingested_at, id) > (SELECT ingested_at, id FROM images WHERE id = ?)
ORDER BY ingested_at ASC, id ASC
LIMIT ? OFFSET ?

-- page 1 (no cursor)
SELECT … FROM images
WHERE <filter>
ORDER BY ingested_at DESC, id DESC
LIMIT ? OFFSET ?
```

### UI semantics

The UI tracks the current page number as a **transient query param** (`?page=4`). The system does NOT know what page the user is on; `page` is purely a render aid. Stale `page` after collection growth is acceptable. Jump-to-page-N from a non-adjacent state falls back to pure offset.

### Service helper

`src/lib/server/service/_pagination.ts` exposes a typed `paginate<T>(...)` helper that all listing services compose. Per-endpoint code stays focused on filter clauses.

## Response shapes and error format

- Successful responses: JSON, fields in `snake_case` matching DB columns (with timestamp ms-since-epoch).
- Convert ms → ISO **only at the route layer** when the API contract demands it (decide per endpoint; default = keep raw ms for clients to format).
- Error format:
  ```json
  { "error": "<code>", "message"?: "<human readable>", "fields"?: { "<path>": "<msg>" } }
  ```
- Status codes:
  - `200` success.
  - `201` resource created.
  - `204` success with no body.
  - `400` validation failure (Zod errors mapped to `fields`).
  - `401` auth missing/invalid (when auth enabled). Generic, no echo.
  - `403` reserved (no roles in MVP, so unlikely).
  - `404` resource not found.
  - `409` conflict (duplicate slug, etc.).
  - `410` auth disabled on `/api/v1/auth/login`.
  - `429` rate-limited.
  - `500` unexpected — telemetry-correlated error id surfaced as `error_id` field.

## SSE endpoint

- `GET /api/v1/runs/stream` returns `text/event-stream`. Same auth as other API routes.
- Event names: `run.started`, `run.progress` (throttled ~1/sec per active run), `run.finished`.
- See [`frontend.md`](./frontend.md) for the client-side wrapper.

## Don't

- Don't put business logic at the route handler. Parse → call service → respond.
- Don't introduce a second pagination shape — every list uses the contract above.
- Don't ship a list endpoint without the `, id` tie-breaker in the SQL.
- Don't echo submitted credentials in 401 responses.
- Don't add a new versioned prefix — `/api/v1` is sufficient until a true breaking change.
- Don't expose admin/CLI surfaces over HTTP. Admin Unix-socket arrives post-MVP when CLI returns.
