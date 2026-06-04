---
title: Docker
description: Docker compose, volumes, healthchecks, and image layout.
---

The primary distribution shape is Docker. The Dockerfile produces a
multi-stage image that runs as a non-root user.

## Image layout

| Stage     | Base               | Purpose                                                 |
| --------- | ------------------ | ------------------------------------------------------- |
| `deps`    | `oven/bun:1`       | `bun install --frozen-lockfile`                         |
| `build`   | `oven/bun:1`       | `bun run build` (SvelteKit + adapter-bun output)        |
| `runtime` | `oven/bun:1-slim`  | Non-root user `wallrus`, `/data/wallrus` owned + 0700, VOLUME, EXPOSE 5173 |

## docker-compose.yml (reference)

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
      # WALLRUS_PASSWORD: "change-me"
      # WALLRUS_AUTH_SECRET: "<openssl rand -hex 32>"
      # WALLRUS_TRUST_PROXY: "true"
      # OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318"
    volumes:
      - wallrus-data:/data/wallrus

volumes:
  wallrus-data:
    driver: local
```

## User & permissions

The container entrypoint runs `chown -R PUID:PGID /data/wallrus` on startup (only when the ownership doesn't already match), then drops to that user before launching the daemon. The daemon never runs as root.

Set `PUID` and `PGID` to your host user's IDs so the collection is directly readable from the host:

```yaml
    environment:
      PUID: "1000"   # host: id -u
      PGID: "1000"   # host: id -g
      UMASK: "027"   # optional, this is the default
```

Permission model inside `/data/wallrus`:

| Path                                       | Mode   | Rationale                                                                          |
| ------------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `/data/wallrus/` and device/thumb dirs     | `0750` | Owner + group access; no world read.                                               |
| Image files (`<device-slug>/…`)            | `0640` | Owner read/write, group read — easy sharing via Samba or Syncthing.                |
| `wallrus.db`, `wallrus.db-wal`, `.db-shm`  | `0600` | Owner-only. The DB holds source credentials in plaintext; group members cannot read it even though they can list the data dir. |

Adjust `UMASK` only if you need stricter (`077`, owner-only for everything) or looser (`022`, world-readable images) permissions.

## Volume

The container expects the data dir mounted at `/data/wallrus`. Inside:

```
/data/wallrus/
├── wallrus.db, wallrus.db-wal, wallrus.db-shm
├── .thumbs/<image-uuid>.webp
├── .staging/<uuid>
└── <device-slug>/<source-slug>-<filename>.<ext>
```

Use a named volume (as above) or bind-mount a host directory. Both work.

## Healthcheck

The image ships a `HEALTHCHECK` that probes `GET /healthz` every 30 s. Compose
/ Kubernetes pickups it automatically; nothing to configure on your side.

## Building from source

```sh
git clone https://github.com/tigorlazuardi/wallrus
cd wallrus
docker build -t wallrus .
```

## Updating

```sh
docker compose pull && docker compose up -d
```

Migrations run automatically at every start — the new container picks up
exactly where the old one left off. No manual migration step.
