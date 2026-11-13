package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/oauth"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"
	"tera-router/server/internal/services"

	"github.com/getsentry/sentry-go"
)

func main() {
	var cfg config.Config
	parseFlag(&cfg)

	loggerLevel := slog.LevelInfo

	if cfg.App.Debug {
		loggerLevel = slog.LevelDebug
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: loggerLevel,
	}))
	// Packages that log through the slog default logger (repositories emit
	// their debug queries that way) must see the same level and format.
	slog.SetDefault(logger)

	if cfg.OIDC.Enabled() {
		name := cfg.OIDC.ProviderName
		if name == "" {
			name = "SSO"
		}
		logger.Info(fmt.Sprintf("OpenID Connect SSO enabled (%s)", name))
		if cfg.OIDC.AutoProvision && strings.TrimSpace(cfg.OIDC.AllowedDomains) == "" {
			logger.Warn(fmt.Sprintf(
				"OIDC_AUTO_PROVISION is on with no OIDC_ALLOWED_DOMAINS: anyone with an account at %s can sign in",
				cfg.OIDC.Issuer,
			))
		}
	}

	app := assemble(cfg, logger)

	if app.Config.Sentry.Dsn != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              app.Config.Sentry.Dsn,
			Debug:            cfg.App.Debug,
			Environment:      cfg.App.Env,
			EnableTracing:    true,
			TracesSampleRate: 1.0,
		})
		if err != nil {
			log.Fatalf("sentry.Init: %s", err)
		}
		// Flush buffered events before the program terminates.
		// Set the timeout to the maximum duration the program can afford to wait.
		defer sentry.Flush(2 * time.Second)
	}

	defer app.Close()

	if err := serve(app); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}

// assemble opens the database pool and wires repositories and services into
// the application container. It logs and exits on any wiring failure — the
// server cannot run half-initialized.
func assemble(cfg config.Config, logger *slog.Logger) *app.Application {
	db, err := database.Open(cfg.Database.Path)
	if err != nil {
		log.Fatalf("open database: %s", err)
	}

	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		log.Fatalf("derive sealing key: %s", err)
	}

	// Migrate and seed on boot: apply pending migrations, then the idempotent
	// baseline seeders, before any repository assumes the schema or its
	// reference rows exist. A failure in either aborts startup.
	if cfg.Database.MigrateOnBoot {
		logger.Info("migrate on boot enabled, applying migrations...")
		if err := migrator.Up(db, migrator.DefaultDir); err != nil {
			log.Fatalf("migrate on boot: %s", err)
		}
		logger.Info("migrations applied")
	}

	if cfg.Database.SeedOnBoot {
		logger.Info("seed on boot enabled, seeding baseline data...")
		seeders.Run(db, cfg.App.Env == config.EnvDevelopment, secrets)
		logger.Info("baseline data seeded")
	}

	repos := repositories.New(db, &cfg.App)

	// Secrets sealed by a release that did not bind them to their column are
	// bound now. An older release cannot open them afterwards, so a copy of
	// the database is written first for a rollback to restore. Stopping here
	// on a failure beats serving with credentials nothing can open.
	ctx := context.Background()
	preUpgrade := fmt.Sprintf("%s.pre-seal-upgrade-%s.bak", cfg.Database.Path, time.Now().UTC().Format("20060102-150405"))
	n, err := repositories.ResealLegacy(ctx, db, secrets, func() error { return repos.Backup.VacuumInto(ctx, preUpgrade) })
	if err != nil {
		log.Fatalf("upgrade sealed credentials: %s", err)
	}
	if n > 0 {
		logger.Info("sealed credentials bound to their columns; keep the copy to roll back to an older release", "count", n, "copy", preUpgrade)
	}

	logger.Info("dependencies assembled", "database", cfg.Database.Path)

	return &app.Application{
		Config:   cfg,
		Logger:   logger,
		DB:       db,
		Repos:    repos,
		Secrets:  secrets,
		Services: services.New(),
		OAuth:    oauth.NewManager(repos, secrets, logger),
		IPBlocks: ipblock.New(repos.IPBlocks, repos.Settings),
	}
}
