package main

import (
	"flag"
	"log"
	"tera-router/server/internal/config"
)

func parseFlag(cfg *config.Config) {
	var machineID uint

	// App
	flag.UintVar(&machineID, "machine-id", 0, "Machine ID")
	flag.StringVar(&cfg.App.Env, "env", "development", "Environment")
	flag.BoolVar(&cfg.App.Debug, "debug", false, "Debug mode")
	flag.IntVar(&cfg.App.Port, "port", 8080, "Port")
	flag.StringVar(&cfg.App.Name, "app-name", "tera-router-server", "App Name")
	flag.StringVar(&cfg.App.Secret, "app-secret", "", "App Secret")
	flag.StringVar(&cfg.App.CORSAllowedOrigins, "cors-allowed-origins", "*", "CORS Allowed Origins")

	// Database
	flag.StringVar(&cfg.Database.URL, "database-url", "", "Database URL")

	// Sentry
	flag.StringVar(&cfg.Sentry.Dsn, "sentry-dsn", "", "Sentry DSN")

	flag.Parse()

	uint16Max := uint(1<<16 - 1)
	if machineID > uint16Max {
		log.Fatal("flag machine-id can only handle uint16")
		return
	}

	cfg.App.MachineID = uint16(machineID)

	validateFlag(cfg)
}

func validateFlag(cfg *config.Config) {
	if cfg.App.Env == "" {
		log.Println("flag environment is marked as local")
	}

	if cfg.App.MachineID == 0 {
		log.Fatal("flag machine-id must be provided and cannot be 0")
	}

	if cfg.App.Secret == "" {
		log.Fatal("flag app-secret must be provided")
	}
}
