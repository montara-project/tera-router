package seeders

import (
	"database/sql"
	"log"
)

// ProviderSeeder is the aggregate seeder referenced by cmd/migrate: it runs
// every dashboard seed in dependency order.
type ProviderSeeder struct {
	DB *sql.DB
}

func (s ProviderSeeder) Name() string { return "provider" }

func (s ProviderSeeder) Seed() {
	seedAll := []Seeder{
		RoleSeeder{DB: s.DB},
		AdminUserSeeder{DB: s.DB},
		DefaultPlanSeeder{DB: s.DB},
		SettingsSeeder{DB: s.DB},
	}
	for _, seeder := range seedAll {
		log.Printf("running %s seed...", seeder.Name())
		seeder.Seed()
	}
}
