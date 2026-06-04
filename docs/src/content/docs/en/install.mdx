---
title: Install
description: Quick-start with Docker or bare-metal.
---

import { Tabs, TabItem } from "@astrojs/starlight/components"

## Quick-start

<Tabs>
	<TabItem label="Docker compose" icon="seti:docker">
		```yaml
		# docker-compose.yml
		services:
		  wallrus:
		    image: wallrus:latest      # or build from source
		    container_name: wallrus
		    restart: unless-stopped
		    ports:
		      - "5173:5173"
		    environment:
		      WALLRUS_AUTH_ENABLE: "false"   # assumes a reverse proxy upstream
		    volumes:
		      - wallrus-data:/data/wallrus

		volumes:
		  wallrus-data:
		```

		Then:

		```sh
		docker compose up -d
		```

		Open <http://localhost:5173/>.
	</TabItem>
	<TabItem label="Docker run" icon="seti:docker">
		```sh
		docker run --rm -p 5173:5173 \
		  -e WALLRUS_AUTH_ENABLE=false \
		  -v wallrus-data:/data/wallrus \
		  wallrus:latest
		```
	</TabItem>
	<TabItem label="Bare-metal" icon="seti:bash">
		Needs [Bun](https://bun.com) installed.

		```sh
		git clone https://github.com/tigorlazuardi/wallrus
		cd wallrus
		bun install
		bun run build
		WALLRUS_DATA_DIR=./data WALLRUS_AUTH_ENABLE=false bun run src/cli.ts serve
		```
	</TabItem>
</Tabs>

## Enabling built-in auth

Generate a strong secret and set the three credential env vars:

```sh
export WALLRUS_AUTH_ENABLE=true
export WALLRUS_USERNAME=admin
export WALLRUS_PASSWORD='change-me-please'
export WALLRUS_AUTH_SECRET="$(openssl rand -hex 32)"
```

See [Auth](../configuration/auth/) for the full credential flow.

## What happens on first boot

1. wallrus reads env (refuses to start if auth is enabled but
   `WALLRUS_AUTH_SECRET` is shorter than 32 bytes).
2. Ensures the data dir exists with mode `0700`.
3. Opens the SQLite database, applies the bundled migrations automatically.
4. Tightens the DB file to mode `0600`.
5. Sweeps any `run_history` rows left in the `running` state (from a previous
   crash) to `failed`.
6. Starts the HTTP server on `WALLRUS_LISTEN_ADDR` (default `0.0.0.0:5173`).

No manual migration step required — wallrus auto-migrates on every start.
