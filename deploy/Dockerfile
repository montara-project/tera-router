# syntax=docker/dockerfile:1

# ====================================================================================
# Stage 1: web-ui (Vite build -> static dist)
# ====================================================================================
FROM node:24-alpine AS web-ui

WORKDIR /build

# The workspace manifest and lockfile must be present before install so pnpm
# resolves the frozen workspace graph.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web-ui/package.json apps/web-ui/package.json

RUN corepack enable && pnpm install --frozen-lockfile --filter @tera/web

COPY apps/web-ui apps/web-ui

# `exec` bypasses the package.json lifecycle, so prebuild (format/lint/typecheck)
# and `tsc -b` don't run — image builds only bundle; checks belong to CI/dev.
RUN pnpm --filter @tera/web exec vite build

# ====================================================================================
# Stage 2: server (Go build)
# ====================================================================================
FROM golang:1.26-alpine AS server

WORKDIR /build

COPY apps/server/go.mod apps/server/go.sum ./

RUN go mod download

COPY apps/server ./

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /build/tera-server ./cmd/api

# ====================================================================================
# Stage 3: runtime (server + web-ui static files in ./public)
# ====================================================================================
FROM alpine:3.22

# ca-certificates: outbound calls to upstream providers are HTTPS.
# tzdata: timestamps in logs and the dashboard follow the host timezone.
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S tera && adduser -S tera -G tera \
    && mkdir -p /app/data && chown tera:tera /app/data

WORKDIR /app

COPY --from=server /build/tera-server ./tera-server
COPY --from=web-ui /build/apps/web-ui/dist ./public

# The migrator resolves ./migrations relative to the working directory, so the
# SQL files must ship alongside the binary for --migrate-on-boot.
COPY apps/server/migrations ./migrations

# The SQLite file lives on a volume so it survives image upgrades.
VOLUME ["/app/data"]

USER tera

EXPOSE 8080

ENTRYPOINT ["./tera-server"]
CMD ["--env=production", "--port=8080", "--database-path=/app/data/terarouter.db"]
