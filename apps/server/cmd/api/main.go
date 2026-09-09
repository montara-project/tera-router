package main

import (
	"log"
	"log/slog"
	"os"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"

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

	// Dependencies Injection
	app := &app.Application{
		Config: cfg,
		Logger: logger,
	}

	if app.Config.Sentry.Dsn != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:           app.Config.Sentry.Dsn,
			Debug:         cfg.App.Debug,
			Environment:   cfg.App.Env,
			EnableTracing: true,
		})
		if err != nil {
			log.Fatalf("sentry.Init: %s", err)
		}
		// Flush buffered events before the program terminates.
		// Set the timeout to the maximum duration the program can afford to wait.
		defer sentry.Flush(2 * time.Second)
	}

	if err := serve(app); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}
