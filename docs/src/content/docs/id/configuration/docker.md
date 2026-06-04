---
title: Docker
description: Docker compose, volume, healthcheck, dan layout image.
---

Bentuk distribusi utama adalah Docker. Dockerfile menghasilkan image
multi-stage yang berjalan sebagai user non-root.

## Layout image

| Stage     | Base               | Fungsi                                                      |
| --------- | ------------------ | ----------------------------------------------------------- |
| `deps`    | `oven/bun:1`       | `bun install --frozen-lockfile`                             |
| `build`   | `oven/bun:1`       | `bun run build` (output SvelteKit + adapter-bun)            |
| `runtime` | `oven/bun:1-slim`  | User non-root `wallrus`, `/data/wallrus` owned + 0700, VOLUME, EXPOSE 5173 |

## docker-compose.yml (referensi)

```yaml
services:
  wallrus:
    image: wallrus:latest
    container_name: wallrus
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      WALLRUS_AUTH_ENABLE: "false"
      # WALLRUS_USERNAME: "admin"
      # WALLRUS_PASSWORD: "ganti-segera"
      # WALLRUS_AUTH_SECRET: "<openssl rand -hex 32>"
      # WALLRUS_TRUST_PROXY: "true"
      # OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318"
    volumes:
      - wallrus-data:/data/wallrus

volumes:
  wallrus-data:
    driver: local
```

## User & permission

Entrypoint container menjalankan `chown -R PUID:PGID /data/wallrus` saat startup (hanya bila ownership belum sesuai), lalu berpindah ke user tersebut sebelum daemon dimulai. Daemon tidak pernah berjalan sebagai root.

Set `PUID` dan `PGID` sesuai ID user host kamu agar koleksi bisa langsung dibaca dari host:

```yaml
    environment:
      PUID: "1000"   # host: id -u
      PGID: "1000"   # host: id -g
      UMASK: "027"   # opsional, ini adalah default
```

Model permission di dalam `/data/wallrus`:

| Path                                       | Mode   | Keterangan                                                                                              |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------- |
| `/data/wallrus/` dan direktori device/thumb | `0750` | Akses owner + group; tidak bisa dibaca oleh publik.                                                     |
| File gambar (`<device-slug>/…`)            | `0640` | Owner baca/tulis, group baca — mudah dibagikan via Samba atau Syncthing.                                |
| `wallrus.db`, `wallrus.db-wal`, `.db-shm`  | `0600` | Owner saja. DB menyimpan kredensial source dalam plaintext; anggota group tidak bisa membacanya meski bisa melihat isi data dir. |

Ubah `UMASK` hanya bila kamu perlu permission lebih ketat (`077`, hanya owner untuk segalanya) atau lebih longgar (`022`, gambar bisa dibaca publik).

## Volume

Container mengharapkan data dir di-mount di `/data/wallrus`. Isinya:

```
/data/wallrus/
├── wallrus.db, wallrus.db-wal, wallrus.db-shm
├── .thumbs/<image-uuid>.webp
├── .staging/<uuid>
└── <device-slug>/<source-slug>-<filename>.<ext>
```

Gunakan named volume (seperti di atas) atau bind-mount direktori host.
Keduanya bekerja.

## Healthcheck

Image menyertakan `HEALTHCHECK` yang memeriksa `GET /healthz` tiap 30 detik.
Compose / Kubernetes mendeteksinya otomatis; tidak perlu konfigurasi
tambahan dari sisi kamu.

## Build dari source

```sh
git clone https://github.com/tigorlazuardi/wallrus
cd wallrus
docker build -t wallrus .
```

## Update

```sh
docker compose pull && docker compose up -d
```

Migrasi otomatis dijalankan setiap start — container baru melanjutkan persis
dari titik berhenti container lama. Tidak ada langkah migrasi manual.
