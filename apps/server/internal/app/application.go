package app

import (
	"database/sql"
	"log/slog"
	"sync/atomic"

	"tera-router/server/internal/config"
	"tera-router/server/internal/ipblock"
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
	// OAuth refreshes expiring OAuth access tokens (anthropic, codex) just in
	// time; nil in tools that never dispatch through the gateway.
	OAuth *oauth.Manager
	// IPBlocks refuses blocked client addresses; nil in tools without an
	// HTTP server.
	IPBlocks *ipblock.Guard

	keysVersion atomic.Int64
}

// KeysChanged invalidates every API key the gateway verified and cached.
// Call it after any write that can disable, delete or reshape a key, so the
// change takes effect on the next request instead of after the cache TTL.
func (a *Application) KeysChanged() { a.keysVersion.Add(1) }

// KeysVersion identifies the current API key state for the gateway's cache.
func (a *Application) KeysVersion() int64 { return a.keysVersion.Load() }

// Close releases the database pool.
func (a *Application) Close() {
	if a.DB != nil {
		_ = a.DB.Close()
	}
}
