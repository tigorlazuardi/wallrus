---
title: Memulai
description: Apa itu wallrus, apa yang dilakukannya, dan apa saja yang perlu kamu siapkan.
---

wallrus adalah daemon kecil yang kamu jalankan di mesin sendiri. Secara
periodik ia mengambil wallpaper dari sumber yang kamu atur (subreddit di
Reddit, situs Booru), menerapkan filter per perangkat (resolusi, rasio
aspek, tag, mode NSFW), lalu menyajikan koleksinya lewat WebUI dan API JSON.

## Yang kamu butuhkan

- Mesin yang bisa menjalankan
  [Docker](https://docs.docker.com/get-docker/) — atau alternatifnya, runtime
  Bun kalau lebih suka jalanin tanpa container.
- Disk kosong minimal 1 GB untuk database SQLite, thumbnail, dan gambar yang
  dikoleksi.
- Opsional: reverse proxy (Authelia, Tailscale, Caddy, …) bila autentikasi
  ingin di-handle di atas. wallrus juga menyediakan auth bawaan yang
  sederhana.

## Langkah selanjutnya

1. [Instalasi](./install/) — jalur cepat Docker atau jalur bare-metal.
2. [Variabel lingkungan](../configuration/env/) — referensi env lengkap.
3. [Autentikasi](../configuration/auth/) — bawaan vs reverse-proxy.
4. [Docker](../configuration/docker/) — compose, volume, healthcheck.

## Yang BUKAN dilakukan wallrus

- Bukan wallpaper-setter. Aplikasi mobile/native di masa depan yang akan
  membaca API dan memasang wallpaper di perangkatmu. wallrus hanya
  menyimpan dan menyajikan.
- Bukan multi-user. Satu kredensial bersama, di-set lewat env. Untuk auth
  yang lebih kaya, gunakan reverse proxy.
- Bukan CDN. Ini daemon homelab satu mesin.
