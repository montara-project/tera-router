package seeders

import (
	"database/sql"
	"log"

	"github.com/google/uuid"
)

// RoleSeeder ensures the admin and user roles exist.
type RoleSeeder struct {
	DB *sql.DB
}

func (s RoleSeeder) Name() string { return "roles" }

func (s RoleSeeder) Seed() {
	for _, role := range []struct {
		id   string
		name string
	}{
		{uuid.MustParse("00000000-0000-0000-0000-000000000001").String(), "admin"},
		{uuid.MustParse("00000000-0000-0000-0000-000000000002").String(), "user"},
	} {
		if _, err := s.DB.Exec(`
			INSERT INTO roles (id, name) VALUES ($1, $2)
			ON CONFLICT (name) DO NOTHING`, role.id, role.name); err != nil {
			log.Fatalf("seed role %s: %v", role.name, err)
		}
	}
}
