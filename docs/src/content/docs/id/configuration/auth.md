---
title: Autentikasi
description: Auth bawaan single-user vs auth via reverse proxy.
---

wallrus punya **satu** model autentikasi: username + password bersama
tunggal. Multi-user sengaja di luar scope. Ada dua bentuk deployment.

## A. Auth bawaan (kredensial bersama tunggal)

Set:

```sh
export WALLRUS_AUTH_ENABLE=true
export WALLRUS_USERNAME=admin
export WALLRUS_PASSWORD='ganti-segera-ya'
export WALLRUS_AUTH_SECRET="$(openssl rand -hex 32)"
```

Atau, kalau kamu sudah punya hash Argon2id dari password-mu, lewati
`WALLRUS_PASSWORD` dan berikan hash-nya langsung:

```sh
export WALLRUS_PASSWORD_HASH='$argon2id$v=19$m=65536,...'
```

Cukup salah satu dari `WALLRUS_PASSWORD` / `WALLRUS_PASSWORD_HASH`; kalau
kamu memasukkan plaintext, daemon akan meng-hash-nya saat boot lalu membuang
plaintext dari memori.

| Variabel                | Wajib saat auth aktif | Default | Keterangan                                                       |
| ----------------------- | :-------------------: | ------- | ---------------------------------------------------------------- |
| `WALLRUS_USERNAME`      | Ya                    | —       | Username login tunggal.                                          |
| `WALLRUS_PASSWORD`      | Salah satu dari dua   | —       | Password plaintext; di-hash saat boot, lalu dibuang.             |
| `WALLRUS_PASSWORD_HASH` | Salah satu dari dua   | —       | Hash Argon2id yang sudah dihitung (ganti plaintext jika ada).    |
| `WALLRUS_AUTH_SECRET`   | Ya                    | —       | Minimal 32 byte entropi. Generate: `openssl rand -hex 32`.       |
| `WALLRUS_JWT_TTL_DAYS`  | Tidak                 | `30`    | Masa berlaku JWT / session-cookie dalam hari.                    |

Tiga jenis kredensial yang diterima API:

- `Authorization: Bearer <jwt>` — utama untuk mobile / script. JWT didapat
  via `POST /api/v1/auth/login` dengan `{ "username", "password" }`.
- `Authorization: Basic base64(user:pass)` — praktis untuk curl / tes.
- Cookie `wallrus_session` — di-set oleh form login WebUI. HttpOnly,
  SameSite=Lax, langsung invalid saat `WALLRUS_AUTH_SECRET` di-rotate.

### Endpoint login

```
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "admin", "password": "ganti-segera-ya" }
```

Berhasil: `204 No Content` + `Set-Cookie: wallrus_session=<jwt>; ...`

### Detail sesi

- Nama cookie: `wallrus_session`
- Masa sesi: **30 hari** (bisa diatur via `WALLRUS_JWT_TTL_DAYS`)
- Proteksi brute-force: **5 percobaan gagal** dalam **15 menit** memicu
  lockout `429 Too Many Requests` untuk IP tersebut. Reset otomatis setelah
  window berlalu atau saat login berhasil.

### Rotasi

Ganti `WALLRUS_AUTH_SECRET` (atau username/password) lalu restart. Semua
cookie yang ada dan semua JWT yang sudah terbit langsung invalid sekaligus.

## B. Auth via reverse proxy (Authelia / Tailscale / OIDC)

Set:

```sh
export WALLRUS_AUTH_ENABLE=false
export WALLRUS_TRUST_PROXY=true  # bila di belakang https
```

Saat auth dimatikan:

- Setiap route publik dari sudut pandang wallrus.
- `POST /api/v1/auth/login` mengembalikan `204 No Content` (no-op; aman
  dipanggil, tidak ada cookie yang di-set).
- Satu peringatan startup dicatat agar pilihan ini terlihat.

Reverse proxy yang sepenuhnya bertanggung jawab menahan traffic tidak
terotentikasi. Setup yang direkomendasikan: Authelia + nginx/Caddy/Traefik,
Tailscale Funnel + Serve, atau gateway OIDC apa pun.

## Mengapa tidak ada refresh token JWT, multi-user, atau reset password?

- Single-user → login ulang saat JWT habis itu murah; tidak perlu kompleksitas
  refresh.
- Multi-user → di luar scope; pasang identity provider sungguhan di depan
  bila dibutuhkan.
- Reset password → di luar scope; rotasi env vars lalu restart.
