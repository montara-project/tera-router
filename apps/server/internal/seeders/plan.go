package seeders

import (
	"database/sql"
	"log"

	"github.com/google/uuid"
)

// DefaultPlanSeeder creates the baseline plan every new key can inherit.
type DefaultPlanSeeder struct {
	DB *sql.DB
}

func (s DefaultPlanSeeder) Name() string { return "default_plan" }

func (s DefaultPlanSeeder) Seed() {
	_, err := s.DB.Exec(`
		INSERT INTO plans (id, name, description, period, alert_pct, hard_cutoff)
		VALUES ($1, 'Default', 'Plan defaults', 'monthly', 80, true)
		ON CONFLICT (id) DO NOTHING`,
		uuid.MustParse("00000000-0000-0000-0000-000000000010"),
	)
	if err != nil {
		log.Fatalf("seed default plan: %v", err)
	}
}
