---
title: Variabel lingkungan
description: Semua env var yang dibaca wallrus, default-nya, dan apa yang dikontrol.
---

Ini **daftar kanonik tunggal** semua variabel lingkungan yang dibaca wallrus.
Sumber kebenarannya adalah `src/lib/server/env.ts` di repo — saat file itu
berubah, halaman ini ikut berubah di kedua bahasa.

## Wajib saat auth aktif

Wajib hanya bila `WALLRUS_AUTH_ENABLE=true`. Default-nya `false` — instalasi
fresh berjalan tanpa auth, dengan asumsi ada reverse proxy di depan wallrus
yang menangani auth. Set `WALLRUS_AUTH_ENABLE=true` untuk membuat wallrus
mengatur auth sendiri, di mana ketiga env di bawah jadi wajib diisi.

| Variabel              | Wajib                | Default | Deskripsi                                                                                                                                |
| --------------------- | -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `WALLRUS_USERNAME`    | ya (saat auth aktif) | —       | Username bersama untuk WebUI dan API JSON.                                                                                               |
| `WALLRUS_PASSWORD`    | ya (saat auth aktif) | —       | Password bersama. Pembandingan dilakukan timing-safe.                                                                                    |
| `WALLRUS_AUTH_SECRET` | ya (saat auth aktif) | —       | Minimal 32 byte entropy. Dipakai untuk HMAC cookie DAN signing key HS256 JWT. Generate dengan `openssl rand -hex 32`.                    |

Bila `WALLRUS_AUTH_ENABLE=false`, ketiganya diabaikan.

## Selalu tersedia

| Variabel                | Default                                            | Deskripsi                                                                                                                                                |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALLRUS_AUTH_ENABLE`   | `false`                                            | `"true"` atau `"false"`. Bila `false` (default), semua route publik dan endpoint login mengembalikan `404` / `410` — cocok untuk deployment di belakang reverse proxy. Set ke `true` untuk membuat wallrus mengatur auth sendiri (perlu ketiga env kredensial di atas). |
| `WALLRUS_DATA_DIR`      | `./data` (bare-metal) \| `/data/wallrus` (Docker)  | Direktori penyimpanan database SQLite, thumbnail, file staging, dan subdir per perangkat. Daemon menerapkan `chmod 0700` di dir ini.                       |
| `WALLRUS_LISTEN_ADDR`   | `0.0.0.0:5173`                                     | Host + port yang dipakai server HTTP.                                                                                                                    |
| `WALLRUS_MODE`          | `prod`                                             | `"prod"` atau `"dev"`. Bila `dev`, `wallrus serve` melewati `Bun.serve` dan keluar setelah boot. Gunakan `bun run dev` untuk pengembangan lokal (dikelola Vite). Docker image selalu berjalan dalam mode `prod`. |
| `WALLRUS_JWT_TTL_DAYS`  | `30`                                               | Umur JWT (integer positif). Tidak ada refresh token; login ulang saat habis.                                                                             |
| `WALLRUS_TRUST_PROXY`   | `false`                                            | `"true"` atau `"false"`. Bila aktif, wallrus mempercayai `X-Forwarded-Proto` + `X-Forwarded-For` dari first hop saja.                                     |

## OpenTelemetry (env standar OTel)

wallrus membaca nama env **standar** OpenTelemetry. Gunakan variabel yang sama yang biasa kamu pakai untuk SDK / collector OTel mana pun.

| Variabel                      | Default     | Deskripsi                                                                                                                                                                                       |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | tidak diset | URL dasar OpenTelemetry collector (mis. `http://otel-collector:4318`). Bila tidak di-set, ekspor OTLP dimatikan dan log hanya ke stderr.                                                        |
| `OTEL_SERVICE_NAME`           | `wallrus`   | Nama service yang dilaporkan di setiap span / log / metric. Override bila kamu menjalankan beberapa instance wallrus di belakang satu collector.                                                |
| `OTEL_RESOURCE_ATTRIBUTES`    | tidak diset | Pasangan `key=value` yang dipisah koma, digabung ke OpenTelemetry Resource (mis. `deployment.environment=prod,service.instance.id=tv-rack`). Default sudah berisi `service.namespace=homelab`. |
| `OTEL_EXPORTER_OTLP_HEADERS`  | tidak diset | Pasangan `key=value` dipisah koma (split di `=` pertama per pair, JWT yang berisi `=` aman). Di-inject oleh exporter daemon sendiri dan proxy `/otlp` untuk browser. Pakai untuk `Authorization=Bearer …` atau `x-api-key=…`. |

## Proxy telemetry browser

| Variabel                | Default  | Deskripsi                                                                                                                                                                              |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALLRUS_OTEL_FRONTEND` | `enable` | Salah satu dari `enable`, `auth`, `disable`. Mengontrol proxy `/otlp` yang meneruskan sinyal OTel browser ke upstream. Lihat [Telemetry browser](./browser-telemetry/) untuk matriks posture lengkap. |

## User container (Docker)

Variabel-variabel ini dibaca oleh skrip entrypoint container — **bukan** oleh aplikasi wallrus itu sendiri. Tidak berpengaruh di luar Docker.

| Variabel | Default | Deskripsi                                                                                                                                                              |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUID`   | `1000`  | Numeric user ID yang dipakai daemon. Entrypoint men-`chown` `/data/wallrus` ke UID ini saat startup, lalu melepas hak root sebelum daemon berjalan.                    |
| `PGID`   | `1000`  | Numeric group ID. File dan direktori dimiliki oleh GID ini, sehingga siapa pun dalam grup tersebut (mis. Samba, Syncthing) bisa membaca koleksi gambar.                |
| `UMASK`  | `027`   | Masker pembuatan file di dalam container. `027` menghasilkan `0750` untuk direktori dan `0640` untuk file. DB kredensial (`wallrus.db`) selalu `0600` bagaimanapun. |

Default (`1000:1000`) cocok dengan user non-root pertama di kebanyakan distro desktop dan NAS — tidak perlu diubah kecuali host kamu menggunakan UID/GID berbeda.

## Perilaku fail-fast

Bila `WALLRUS_AUTH_ENABLE=true` dan salah satu dari tiga env kredensial
hilang atau `WALLRUS_AUTH_SECRET` kurang dari 32 byte, daemon menolak start
dengan pesan error yang menjelaskan cara membuat secret.

Set `WALLRUS_AUTH_ENABLE=false` untuk opt-out (misal saat ada reverse proxy
yang menangani auth).
