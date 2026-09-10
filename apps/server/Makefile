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
# BUILD
# ==================================================================================== #

## build/api: build the cmd/api application
.PHONY: build/api
build/api:
	@echo 'Building cmd/api...'
	go build -ldflags="-s" -o=./bin/api ./cmd/api
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s" -o=./bin/linux_amd64/api ./cmd/api
