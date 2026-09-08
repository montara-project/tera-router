package main

import (
	"log/slog"
	"os"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
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

	if err := serve(app); err != nil {
		logger.Error("failed to start server", "error", err.Error())
		os.Exit(1)
	}
}
