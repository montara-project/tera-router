# syntax=docker/dockerfile:1

# ====================================================================================
# Stage 1: web-ui (Vite build -> static dist)
# ====================================================================================
FROM node:24-alpine AS web-ui

WORKDIR /build

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web-ui/package.json apps/web-ui/package.json

RUN corepack enable && pnpm install --frozen-lockfile --filter @tera/web-ui

COPY apps/web-ui apps/web-ui

RUN pnpm --filter @tera/web-ui build

# ====================================================================================
# Stage 2: server (Go build)
# ====================================================================================
FROM golang:1.25-alpine AS server

WORKDIR /build

COPY apps/server/go.mod apps/server/go.sum ./

RUN go mod download

COPY apps/server ./

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /build/tera-server ./cmd/api

# ====================================================================================
# Stage 3: runtime (server + web-ui static files in ./public)
# ====================================================================================
FROM alpine:3.22

RUN addgroup -S tera && adduser -S tera -G tera

WORKDIR /app

COPY --from=server /build/tera-server ./tera-server
COPY --from=web-ui /build/apps/web-ui/dist ./public

USER tera

EXPOSE 8080

ENTRYPOINT ["./tera-server"]
CMD ["--env=production", "--port=8080"]
