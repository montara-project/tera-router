package main

import (
	"database/sql"
	"fmt"
	"log"

	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/seeders"
)

func main() {
	var cfg config
	parseFlag(&cfg)

	db, err := database.Open(cfg.dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	switch cfg.mode {
	case modeUp:
		migrateUp(db)
	case modeDown:
		migrateDown(db)
	case modeRefresh:
		migrateDown(db)
		migrateUp(db)
	}

	if cfg.seed != "" {
		seeders.Run(db, cfg.seed == seedDevelopment)
	}

	fmt.Println("Completed")
}

func migrateUp(db *sql.DB) {
	fmt.Println("Running up migrations...")
	if err := migrator.Up(db, migrator.DefaultDir); err != nil {
		log.Fatalf("failed to run up migrations: %v", err)
	}
}

func migrateDown(db *sql.DB) {
	fmt.Println("Running down migrations...")
	if err := migrator.Down(db, migrator.DefaultDir); err != nil {
		log.Fatalf("failed to run down migrations: %v", err)
	}
}
