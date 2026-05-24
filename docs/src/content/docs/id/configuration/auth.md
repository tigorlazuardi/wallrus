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

Tiga kredensial diterima di API:

- `Authorization: Bearer <jwt>` — utama untuk mobile / script. JWT didapat
  via `POST /api/v1/auth/login` dengan `{ "username", "password" }`.
- `Authorization: Basic base64(user:pass)` — praktis untuk curl / tes.
- Cookie `auth_session` — di-set oleh form login WebUI. httpOnly,
  SameSite=Lax, langsung invalid saat `WALLRUS_AUTH_SECRET` di-rotate.

WebUI menyajikan halaman login HTML sederhana. TTL JWT default 30 hari.
Tidak ada refresh token — login ulang saat habis.

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
- `GET /auth/login` mengembalikan `404`.
- `POST /api/v1/auth/login` mengembalikan `410 Gone`, body `{ "error": "auth_disabled" }`.
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
