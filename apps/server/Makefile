-include .env

# ==================================================================================== #
# HELPERS
# ==================================================================================== #

## help: print this help message
.PHONY: help
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' |  sed -e 's/^/ /'

# ==================================================================================== #
# APPLICATION
# ==================================================================================== #

## install: install dependencies
.PHONY: install
install:
	go mod tidy

## run: run the application
.PHONY: run
run:
	go run ./cmd/api \
		--machine-id=$(MACHINE_ID) \
		--debug=$(DEBUG) \
		--env=$(ENV) \
		--port=$(PORT) \
		--app-name=$(APP_NAME) \
		--app-secret=$(APP_SECRET) \
		--cors-allowed-origins=$(CORS_ALLOWED_ORIGINS) \
		--database-url=$(DATABASE_URL) \
		--sentry-dsn=$(SENTRY_DSN)

# ==================================================================================== #
# DATABASE
# ==================================================================================== #

## migrate/up: apply up migrations
.PHONY: migrate/up
migrate/up:
	go run ./cmd/migrate --db-dsn=$(DATABASE_URL) up

## migrate/down: roll back all migrations
.PHONY: migrate/down
migrate/down:
	go run ./cmd/migrate --db-dsn=$(DATABASE_URL) down

## migrate/refresh: drop and re-apply all migrations
.PHONY: migrate/refresh
migrate/refresh:
	go run ./cmd/migrate --db-dsn=$(DATABASE_URL) refresh

## seed: run migrations + seed baseline data (use seed/dev for the sample key)
.PHONY: seed
seed:
	go run ./cmd/migrate --db-dsn=$(DATABASE_URL) --seed=prod up

## seed/dev: run migrations + seed baseline data and a sample API key
.PHONY: seed/dev
seed/dev:
	go run ./cmd/migrate --db-dsn=$(DATABASE_URL) --seed=dev up

## test: run all Go tests
.PHONY: test
test:
	go test ./...

## vet: run go vet
.PHONY: vet
vet:
	go vet ./...

# ==================================================================================== #
# BUILD
# ==================================================================================== #

## build/api: build the cmd/api application
.PHONY: build/api
build/api:
	@echo 'Building cmd/api...'
	go build -ldflags="-s" -o=./bin/api ./cmd/api
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s" -o=./bin/linux_amd64/api ./cmd/api
