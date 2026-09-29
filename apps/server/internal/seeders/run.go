package seeders

import (
	"database/sql"
	"log"
)

// Run executes the baseline seeders in dependency order: roles, admin user,
// default plan and settings. When dev is true it also mints the sample API
// key, mirroring `--seed dev` on the migrate CLI.
//
// Every seeder is idempotent, so Run is safe on an already-seeded database and
// can be called on each server boot.
func Run(db *sql.DB, dev bool) {
	toRun := []Seeder{ProviderSeeder{DB: db, Dev: dev}}
	if dev {
		toRun = append(toRun, SampleKeySeeder{DB: db})
	}

	for _, seeder := range toRun {
		log.Printf("running %s seeder...", seeder.Name())
		seeder.Seed()
	}
}
