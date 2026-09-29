package main

import (
	"log"
	"log/slog"
	"os"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/migrator"
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
		seeders.Run(db, cfg.App.Env == config.EnvDevelopment)
		logger.Info("baseline data seeded")
	}

	repos := repositories.New(db, &cfg.App)
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		log.Fatalf("derive sealing key: %s", err)
	}

	logger.Info("dependencies assembled", "database", cfg.Database.Path)

	return &app.Application{
		Config:   cfg,
		Logger:   logger,
		DB:       db,
		Repos:    repos,
		Secrets:  secrets,
		Services: services.New(),
	}
}
