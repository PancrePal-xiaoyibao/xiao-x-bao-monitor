# ─── Stage 1: Build frontend ────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

RUN npm install -g bun

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# ─── Stage 2: Build backend ─────────────────────────────────────────────────────
FROM golang:1.25-alpine AS backend-build

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o /monitor ./cmd/monitor/

# ─── Stage 3: Final image ───────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=backend-build /monitor /app/monitor
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY config/ /app/config/

ENV HTTP_ADDR=:8080
ENV FRONTEND_DIST=/app/frontend/dist
ENV DB_PATH=/app/data/monitor.db
ENV APP_TIMEZONE=Asia/Shanghai
ENV PROVIDER_CONFIG_PATH=/app/config/provider-config.yaml
ENV SCHEDULER_ENABLED=true
ENV SCHEDULER_INTERVAL=10m
ENV SYNC_LOOKBACK_DAYS=30

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["/app/monitor"]
