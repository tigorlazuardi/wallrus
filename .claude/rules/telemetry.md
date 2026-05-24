---
paths:
  - "src/lib/server/**"
  - "src/hooks.server.ts"
  - "src/cli.ts"
  - "src/routes/**/+server.ts"
  - "src/routes/**/+page.server.ts"
  - "src/routes/**/+layout.server.ts"
  - "**/*.test.ts"
---

# wallrus — telemetry & logging rule

Observability across wallrus runs through **`@tigorhutasuhut/telemetry-js`**. That package wraps OpenTelemetry: a structured logger, a uniform error type, span helpers, and the SDK init that wires the exporters. **Logs and traces flow through this lib; metrics go through the OpenTelemetry API directly** (the package only registers the OTel exporters).

Docs: <https://tigorlazuardi.github.io/telemetry-js/modules/bun.html>

## Imports — what comes from where

```ts
// Logger + tracing (re-exported through the bun module)
import { getLogger, traced, withTrace } from "@tigorhutasuhut/telemetry-js/bun"

// Uniform error type
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

// DB span helper
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"

// SDK init — bootstrap only
import { initSDK } from "@tigorhutasuhut/telemetry-js/bun"

// Metrics — straight OTel API (telemetry-js does NOT wrap this)
import { metrics } from "@opentelemetry/api"
```

## Logging

### `getLogger()` replaces every `console.*` call

The Logger interface is:

```ts
interface Logger {
  debug(message: string, attrs?: LogAttributes, opts?: LogOptions): void
  info(message: string, attrs?: LogAttributes, opts?: LogOptions): void
  warn(message: string, attrs?: LogAttributes, opts?: LogOptions): void
  error(message: string, attrs?: LogAttributes, opts?: LogOptions): void
}
```

Dual output: stderr + OTLP. Pretty on TTY, JSON otherwise. `getLogger()` pulls from AsyncLocalStorage so a per-request scoped logger (set via `runWithLogger`) flows through service calls automatically.

Use:

```ts
const log = getLogger()
log.info("subscription scheduled", { subscription_id: sub.id, source_slug: sub.source_slug })
log.warn("source returned 429, backing off", { source_slug, retry_after_ms: 5000 })
log.error("ingest failed", { subscription_id: sub.id, error: err })
```

**Hard rule**: **no `console.log` / `console.error` / `console.warn` / `console.debug`** anywhere under `src/`. The only legitimate `console` use is in test files (`*.test.ts`) for diagnostic dev output, and even there `getLogger()` is preferred.

### Level selection

| Level   | Use for                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| `debug` | Hot-path detail useful for diagnosis (per-item ingest decisions, cron tick evaluations).                         |
| `info`  | State transitions: run started/finished, subscription enabled, device added.                                     |
| `warn`  | Recoverable anomalies: source rate-limited, file perm needed widening, retry exhausted but next-cron will retry. |
| `error` | Failures the user / operator must see. Usually accompanied by an `AppError` re-thrown.                           |

### Attribute discipline

- `attrs` is `Record<string, unknown>` — keep keys snake_case, scalar values, ms-epoch for times.
- **Never include**: passwords, JWTs, cookies, `Authorization` headers, raw request bodies on `/auth/*` routes, source credential payloads. Redact in `attrs` builders if a value might contain any of those.
- Standard keys when applicable: `subscription_id`, `source_slug`, `device_slug`, `image_id`, `run_id`, `duration_ms`, `status`.

## Errors — `AppError`

Use `AppError` everywhere a service throws. It carries `message` (internal), `publicMessage` (safe to surface to API/UI), `status` (HTTP), `fields` (structured), and a `cause` chain.

### Throwing

```ts
import { AppError } from "@tigorhutasuhut/telemetry-js/error"

// new
throw new AppError({
  message: `image not found: ${id}`, // internal, logged
  publicMessage: "Image not found.", // surfaced to user
  status: 404,
  fields: { image_id: id },
})

// short factory
throw AppError.fail(`image not found: ${id}`, { status: 404, fields: { image_id: id } })
```

### Wrapping unknowns

Network calls, DB errors, third-party throws — wrap them with `AppError.wrap` so the cause chain survives.

```ts
try {
  const data = await ctx.http_get_json(url)
  // ...
} catch (err) {
  throw AppError.wrap(err, {
    message: `source.fetch failed for ${slug}`,
    fields: { source_slug: slug, url },
  })
}
```

Equivalent shorter form for whole blocks:

```ts
const data = await AppError.run(async () => fetchUser(id))
```

### Route → AppError mapping

Routes catch service throws and map to HTTP. `AppError.is(err, AppError)` recovers the typed instance from a cause chain. The route returns `{ error, message?, fields? }` per `.claude/rules/api.md` §Response shapes. Status comes from `err.status` (default 500), message comes from `err.publicMessage` (never `err.message`).

### Don't

- Don't `throw new Error("string")` — bare Errors lose the structured fields.
- Don't put internal-only details into `publicMessage` (it's user-facing).
- Don't include credentials, tokens, or PII in `fields`.

## Tracing

### `@traced()` on class methods (services)

Already mandated by `.claude/rules/service.md`: every public service method carries `@traced()`. The decorator auto-names the span `Class.method` (`DeviceService.listDevices`, `ImageService.ingest`). Customize when needed:

```ts
import { traced } from "@tigorhutasuhut/telemetry-js/bun"
import { SpanKind } from "@opentelemetry/api"

class ImageService {
	@traced()
	async ingest(item: SourceItem): Promise<Image> { ... }

	@traced({ name: "image.download", kind: SpanKind.CLIENT })
	async download(url: string): Promise<Uint8Array> { ... }

	@traced(({ args }) => ({ attributes: { "image.id": String(args[0]) } }))
	async get(id: string): Promise<Image> { ... }
}
```

### `withTrace` for non-class functions

For module-level functions worth a span (scheduler tick, fanout pass, cron evaluator):

```ts
import { withTrace } from "@tigorhutasuhut/telemetry-js/bun"

await withTrace(async function tick_subscriptions(span) {
  span.setAttribute("subscriptions.count", subs.length)
  for (const s of subs) await enqueue_if_due(s)
})
```

Named function declarations give automatic span names. Use `opts.name` when wrapping an arrow function:

```ts
await withTrace((span) => fanout(image, span), { name: "fanout" })
```

### `withQueryName` for DB operations

Wraps a DB call in a `SpanKind.CLIENT` span and stores the query name in the OTel context so downstream attributes and logs can pick it up.

```ts
import { withQueryName } from "@tigorhutasuhut/telemetry-js/db"

const rows = await withQueryName("listImagesByDevice", () =>
	db.query.images.findMany({ where: ..., limit: 60 }),
)
```

Use it on non-trivial reads/writes — single-row lookups by PK can skip it; multi-table joins, listing queries, bulk inserts should have one.

## Metrics — straight OTel API

`telemetry-js` registers the OTel meter provider via `initSDK`. To **emit** metrics, import from `@opentelemetry/api`:

```ts
import { metrics } from "@opentelemetry/api"

const meter = metrics.getMeter("wallrus")

const items_seen = meter.createCounter("wallrus.items_seen", {
  description: "Source items returned by paginate before any filter",
  unit: "1",
})

items_seen.add(1, { source_slug: slug, subscription_id: sub.id })
```

Instrument kinds:

| Kind                  | Use for                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `createCounter`       | Monotonic counts: items seen, items new, runs started.                             |
| `createUpDownCounter` | Gauges that go both ways: scheduler queue depth per source.                        |
| `createHistogram`     | Durations / sizes: `run.duration_ms`, `image.file_size`, `fanout.devices_matched`. |

Naming: `wallrus.<noun>[.<qualifier>]`, snake_case. Attributes stay low-cardinality (slug, status, source). **Never** put user-supplied free-text or UUIDs into metric attributes — cardinality blowup.

## Where to wire the SDK

`initSDK(config)` runs once at boot inside `src/lib/server/bootstrap.ts`, before any other module fetches a logger or a tracer. Returns `SDKResult` with lifecycle helpers — keep the handle so graceful shutdown can flush exporters.

`src/lib/server/telemetry.ts` is the thin module that re-exports the surface the rest of the code touches. Don't import `@tigorhutasuhut/telemetry-js/*` directly from services or routes — import from `$lib/server/telemetry` so the bindings are swappable in tests.

## Test discipline

- Unit tests can call `getLogger()` for diagnostic prints — output is captured by `bun test` per file.
- For tests that assert log/metric behavior, wrap the SUT in `runWithLogger(mockLogger, () => …)` to inject a recorder.
- Tests **must not** call `initSDK` — the no-op fallback logger is enough; spawning real exporters from a test slows the suite.

## Don't

- Don't `console.log` anywhere under `src/`.
- Don't `throw new Error("string")` in services or routes — use `AppError`.
- Don't import `@tigorhutasuhut/telemetry-js/*` directly from non-`src/lib/server/` code — go through `$lib/server/telemetry`.
- Don't include credentials / tokens / cookies / `Authorization` headers in log `attrs` or `AppError.fields`.
- Don't add high-cardinality attributes (UUIDs, free-text titles, user input) to metric labels.
- Don't decorate every helper with `@traced()` — only public service methods and call sites worth a span; pure helpers (filter evaluator, path builder) stay un-traced.
