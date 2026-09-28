package main

import (
	"flag"
	"log"
	"slices"
	"strings"

	"tera-router/server/internal/database"
)

const (
	modeUp      = "up"
	modeDown    = "down"
	modeRefresh = "refresh"
)

const (
	seedProduction  = "prod"
	seedDevelopment = "dev"
)

type config struct {
	mode   string
	dbPath string
	seed   string
}

func parseFlag(cfg *config) {
	flag.StringVar(&cfg.dbPath, "db-path", database.DefaultPath, "SQLite database file path")
	flag.StringVar(&cfg.seed, "seed", "", "seed")

	flag.Parse()
	validateFlag(cfg)
}

func validateFlag(cfg *config) {
	cfg.mode = flag.Arg(0)
	availableModes := []string{modeUp, modeDown, modeRefresh}

	if !slices.Contains(availableModes, cfg.mode) {
		log.Fatalf("command must be provided: %s", strings.Join(availableModes, ", "))
	}

	if cfg.dbPath == "" {
		log.Fatal("flag --db-path must not be empty")
	}

	if cfg.mode == modeDown && cfg.seed != "" {
		log.Fatal("flag --seed must not be provided when mode is down")
	}

	if cfg.seed != "" {
		availableSeeds := []string{seedProduction, seedDevelopment}
		if !slices.Contains(availableSeeds, cfg.seed) {
			log.Fatalf("seed must be provided: %s", strings.Join(availableSeeds, ", "))
		}
	}
}
