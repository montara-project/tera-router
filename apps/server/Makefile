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
