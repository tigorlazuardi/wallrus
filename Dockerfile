# syntax=docker/dockerfile:1
#
# Multi-stage build for wallrus. Final image runs as a non-root user, expects
# the data dir mounted at /data/wallrus, exposes :5173.
#
# Build:
#   docker build -t wallrus .
# Run (smallest):
#   docker run --rm -p 5173:5173 \
#     -e WALLRUS_AUTH_ENABLE=false \
#     -v ./wallrus-data:/data/wallrus \
#     wallrus
# See ARCHITECTURE.md §Deployment for full env reference.

# ----- deps -----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts: skip the root `prepare` hook (lefthook install), which is a
# dev-only git-hook setup and fails in the image (no git, no .git dir).
RUN bun install --frozen-lockfile --ignore-scripts

# ----- build -----
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ----- runtime -----
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Non-root user, owned data dir.
RUN groupadd -r wallrus && useradd -r -g wallrus -m -d /home/wallrus wallrus \
	&& mkdir -p /data/wallrus \
	&& chown -R wallrus:wallrus /data/wallrus \
	&& chmod 0700 /data/wallrus

# Copy the SvelteKit build output + the production dependency tree + CLI entry
# + migrations (needed at startup by drizzle-orm/bun-sqlite/migrator).
COPY --from=build  --chown=wallrus:wallrus /app/build         ./build
COPY --from=deps   --chown=wallrus:wallrus /app/node_modules  ./node_modules
COPY              --chown=wallrus:wallrus package.json bun.lock ./
COPY              --chown=wallrus:wallrus drizzle             ./drizzle
COPY              --chown=wallrus:wallrus src                 ./src
# Bun resolves the `$lib/*` alias at runtime via tsconfig `paths`. The mapping
# lives in the SvelteKit-generated `.svelte-kit/tsconfig.json`, which the root
# `tsconfig.json` extends. Ship both so `bun run src/cli.ts` can resolve `$lib`.
COPY --from=build  --chown=wallrus:wallrus /app/tsconfig.json             ./tsconfig.json
COPY --from=build  --chown=wallrus:wallrus /app/.svelte-kit/tsconfig.json ./.svelte-kit/tsconfig.json

# Docker-friendly defaults. Override via -e or compose env.
ENV WALLRUS_DATA_DIR=/data/wallrus \
	WALLRUS_LISTEN_ADDR=0.0.0.0:5173 \
	NODE_ENV=production

USER wallrus
EXPOSE 5173
VOLUME ["/data/wallrus"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
	CMD bun -e 'fetch("http://127.0.0.1:5173/healthz").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["bun", "run", "src/cli.ts", "serve"]
