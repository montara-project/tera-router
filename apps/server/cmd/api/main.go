package main

import (
	"database/sql"
	"log"
	"log/slog"
	"os"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/services"

	"github.com/getsentry/sentry-go"
	_ "github.com/lib/pq"
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
	if cfg.Database.URL == "" {
		log.Fatal("DATABASE_URL / --database-url is required")
	}

	db, err := sql.Open("postgres", cfg.Database.URL)
	if err != nil {
		log.Fatalf("open database: %s", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("database unreachable: %s", err)
	}

	repos := repositories.New(db, &cfg.App)
	services, err := services.New(repos, &cfg, logger)
	if err != nil {
		log.Fatalf("wire services: %s", err)
	}

	logger.Info("dependencies assembled", "database", "connected")

	return &app.Application{
		Config:   cfg,
		Logger:   logger,
		DB:       db,
		Repos:    repos,
		Services: services,
	}
}
