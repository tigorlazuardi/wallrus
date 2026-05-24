---
title: Browser telemetry
description: Forward OpenTelemetry traces, metrics, and logs from the browser through wallrus to your collector.
---

wallrus exposes a same-origin **OTLP/HTTP proxy** at `/otlp` so frontends running in a browser can ship OpenTelemetry signals to your collector without ever seeing the collector's URL or auth token. The server-side `OTEL_EXPORTER_OTLP_HEADERS` (e.g. an `Authorization: Bearer …`) is injected on the way out.

## Posture: `WALLRUS_OTEL_FRONTEND`

The proxy is gated by a single env var.

| Value     | When auth is on (`WALLRUS_AUTH_ENABLE=true`)        | When auth is off                                  |
| --------- | --------------------------------------------------- | ------------------------------------------------- |
| `enable` (default) | Requires authenticated request (cookie / Bearer JWT / Basic). | **Public** — anyone can submit via the proxy.       |
| `auth`    | Requires authenticated request.                     | Returns `401` (auth required) — the proxy refuses unauthenticated submissions even though auth is off globally. |
| `disable` | `404`. Proxy is off.                                | `404`. Proxy is off.                              |

The proxy also requires `OTEL_EXPORTER_OTLP_ENDPOINT` to be set; otherwise it returns `503`.

## Discovery — `GET /api/v1/otel/discover`

Unauthenticated endpoint frontends can poll to ask "should I even try?":

```http
GET /api/v1/otel/discover

200 OK
{
  "enabled": true,
  "auth_required": true,
  "mode": "enable",
  "endpoint": "/otlp"
}
```

- `enabled` — `true` when the proxy can forward (`mode ≠ disable` AND collector configured).
- `auth_required` — whether the client must include credentials.
- `mode` — the raw `WALLRUS_OTEL_FRONTEND` value.
- `endpoint` — `"/otlp"` when enabled, `null` otherwise.

## Browser setup with `@tigorhutasuhut/telemetry-js`

The package ships a browser export with its own `initSDK`. Point its OTLP endpoint at the wallrus same-origin path.

```ts
// e.g. src/lib/client/otel.ts (universal, runs in the browser)
import { initSDK } from "@tigorhutasuhut/telemetry-js/browser"

const discover = await fetch("/api/v1/otel/discover").then((r) => r.json())
if (discover.enabled) {
	initSDK({
		serviceName: "wallrus-web",
		exporterEndpoint: discover.endpoint, // "/otlp"
		resourceAttributes: {
			"browser.user_agent": navigator.userAgent,
		},
	})
}
```

When `auth_required` is true, ensure the same-origin cookie / Bearer header already authenticates the user — `fetch` calls into `/otlp/*` reuse the existing auth context automatically.

## Limits

- **HTTP only** — gRPC collectors are NOT supported. The proxy speaks OTLP/HTTP. Point `OTEL_EXPORTER_OTLP_ENDPOINT` at an HTTP endpoint.
- **Body cap**: 1 MiB per submission. Larger payloads return `413`.
- **No batching layer**: the proxy is dumb — it forwards each POST as it arrives. Use the browser SDK's batching to control upstream load.

## Server-side headers

`OTEL_EXPORTER_OTLP_HEADERS` (standard OTel env, `key1=value1,key2=value2` format) is parsed by the proxy and merged onto every outbound request. Browser never sees these values.

```sh
export OTEL_EXPORTER_OTLP_HEADERS='Authorization=Bearer eyJ...,x-tenant=homelab'
```

The value parser splits on the **first** `=` per pair, so a JWT containing `=` survives intact.
