package app

import (
	"database/sql"
	"log/slog"

	"tera-router/server/internal/config"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/oauth"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/services"
)

// Version is the running app version, injected at build time via
// -ldflags "-X tera-router/server/internal/app.Version=..." (release images
// pass the git tag); source builds report "dev".
var Version = "dev"

// Application is the dependency-injection container threaded through
// handlers and services.
type Application struct {
	Config   config.Config
	Logger   *slog.Logger
	DB       *sql.DB
	Repos    *repositories.Repositories
	Secrets  *sealer.Sealer
	Services *services.Services
	// OAuth refreshes expiring OAuth access tokens (claude, codex) just in
	// time; nil in tools that never dispatch through the gateway.
	OAuth *oauth.Manager
}

// Close releases the database pool.
func (a *Application) Close() {
	if a.DB != nil {
		_ = a.DB.Close()
	}
}
