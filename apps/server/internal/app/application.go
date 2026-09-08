package app

import (
	"log/slog"

	"tera-router/server/internal/config"
)

type Application struct {
	Config config.Config
	Logger *slog.Logger
}
