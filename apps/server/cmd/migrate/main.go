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
		s := []seeders.Seeder{
			seeders.ProviderSeeder{DB: db},
		}
		if cfg.seed == seedDevelopment {
			s = append(s, seeders.SampleKeySeeder{DB: db})
		}

		execSeeders(db, s...)
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

func execSeeders(db *sql.DB, seeders ...seeders.Seeder) {
	for _, seeder := range seeders {
		fmt.Printf("Running %s seeder...\n", seeder.Name())
		seeder.Seed()
	}
}
