package seeders

import (
	"database/sql"
	"log"

	"tera-router/server/internal/lib/sealer"
)

// Run executes the baseline seeders in dependency order: roles, admin user,
// default plan, settings and guardrails. When dev is true it also mints the
// sample API key, mirroring `--seed dev` on the migrate CLI; secrets is then
// required so the key's plaintext can be sealed for later reveal.
//
// Every seeder is idempotent, so Run is safe on an already-seeded database and
// can be called on each server boot.
func Run(db *sql.DB, dev bool, secrets *sealer.Sealer) {
	toRun := []Seeder{
		RoleSeeder{DB: db},
		AdminUserSeeder{DB: db, Dev: dev},
		DefaultPlanSeeder{DB: db},
		SettingsSeeder{DB: db},
		GuardrailsSeeder{DB: db},
	}
	if dev {
		if secrets == nil {
			log.Fatal("dev seed requires a sealer to mint the sample key")
		}
		toRun = append(toRun, SampleKeySeeder{DB: db, Secrets: secrets})
	}

	for _, seeder := range toRun {
		log.Printf("running %s seeder...", seeder.Name())
		seeder.Seed()
	}
}
