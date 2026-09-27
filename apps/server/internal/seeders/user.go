package seeders

import (
	"database/sql"
	"log"
	"os"

	"tera-router/server/internal/lib/password"

	"github.com/google/uuid"
)

// adminEmail and adminPassword seed the first dashboard account. Override
// them at seed time via ADMIN_EMAIL / ADMIN_PASSWORD.
var (
	adminEmail    = envOr("ADMIN_EMAIL", "admin@tera.local")
	adminPassword = envOr("ADMIN_PASSWORD", "admin123")
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// AdminUserSeeder mints the first admin account with a hashed password.
type AdminUserSeeder struct {
	DB *sql.DB
}

func (s AdminUserSeeder) Name() string { return "admin_user" }

func (s AdminUserSeeder) Seed() {
	var exists bool
	if err := s.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, adminEmail).Scan(&exists); err != nil {
		log.Fatalf("check admin user: %v", err)
	}
	if exists {
		return
	}

	hash, err := password.Hash(adminPassword)
	if err != nil {
		log.Fatalf("hash admin password: %v", err)
	}

	_, err = s.DB.Exec(`
		INSERT INTO users (id, fullname, email, password_hash, is_active, role_id)
		VALUES ($1, $2, $3, $4, true, $5)
		ON CONFLICT (email) DO NOTHING`,
		uuid.MustParse("00000000-0000-0000-0000-0000000000ff"), "Administrator", adminEmail, hash,
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
	)
	if err != nil {
		log.Fatalf("seed admin user: %v", err)
	}
}
