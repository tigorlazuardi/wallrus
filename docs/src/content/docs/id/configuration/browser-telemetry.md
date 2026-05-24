---
title: Telemetry browser
description: Forward trace, metric, dan log OpenTelemetry dari browser melalui wallrus ke collector kamu.
---

wallrus menyediakan **proxy OTLP/HTTP** same-origin di `/otlp` sehingga frontend yang berjalan di browser bisa mengirim sinyal OpenTelemetry ke collector kamu tanpa pernah melihat URL collector atau token auth-nya. Header `OTEL_EXPORTER_OTLP_HEADERS` di sisi server (mis. `Authorization: Bearer …`) di-inject di tengah jalan.

## Posture: `WALLRUS_OTEL_FRONTEND`

Proxy dikontrol oleh satu env var.

| Nilai     | Saat auth aktif (`WALLRUS_AUTH_ENABLE=true`)                            | Saat auth mati                                                                              |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `enable` (default) | Butuh request terotentikasi (cookie / Bearer JWT / Basic).        | **Publik** — siapa pun bisa kirim via proxy.                                                |
| `auth`    | Butuh request terotentikasi.                                            | `401`. Proxy menolak submission tanpa auth meskipun auth global mati.                       |
| `disable` | `404`. Proxy mati.                                                      | `404`. Proxy mati.                                                                          |

Proxy juga butuh `OTEL_EXPORTER_OTLP_ENDPOINT` di-set; kalau tidak, mengembalikan `503`.

## Discovery — `GET /api/v1/otel/discover`

Endpoint unauthenticated untuk frontend menanyakan "perlu coba kirim atau tidak?":

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

- `enabled` — `true` saat proxy bisa meneruskan (`mode ≠ disable` DAN collector terkonfigurasi).
- `auth_required` — apakah client harus menyertakan kredensial.
- `mode` — nilai mentah `WALLRUS_OTEL_FRONTEND`.
- `endpoint` — `"/otlp"` saat aktif, `null` saat tidak.

## Setup browser dengan `@tigorhutasuhut/telemetry-js`

Paket ini menyediakan export browser dengan `initSDK` sendiri. Arahkan endpoint OTLP-nya ke path same-origin wallrus.

```ts
// mis. src/lib/client/otel.ts (universal, jalan di browser)
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

Saat `auth_required` bernilai true, pastikan cookie / Bearer same-origin sudah meng-autentikasi user — panggilan `fetch` ke `/otlp/*` otomatis ikut konteks auth yang ada.

## Batasan

- **HTTP only** — collector gRPC TIDAK didukung. Proxy hanya bicara OTLP/HTTP. Arahkan `OTEL_EXPORTER_OTLP_ENDPOINT` ke endpoint HTTP.
- **Batas body**: 1 MiB per submission. Payload lebih besar mengembalikan `413`.
- **Tanpa lapisan batching**: proxy ini bodoh — meneruskan setiap POST apa adanya. Gunakan batching SDK browser untuk mengontrol beban upstream.

## Header sisi server

`OTEL_EXPORTER_OTLP_HEADERS` (env standar OTel, format `key1=value1,key2=value2`) di-parse oleh proxy dan digabungkan ke setiap request keluar. Browser tidak pernah melihat value-nya.

```sh
export OTEL_EXPORTER_OTLP_HEADERS='Authorization=Bearer eyJ...,x-tenant=homelab'
```

Parser value memecah pada `=` **pertama** per pair, sehingga JWT yang berisi `=` tetap utuh.
