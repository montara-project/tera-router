package seeders

import (
	"database/sql"
	"log"
	"os"

	"tera-router/server/internal/lib/password"

	"github.com/google/uuid"
)

// adminEmail seeds the first dashboard account. Override it at seed time via
// ADMIN_EMAIL.
var adminEmail = envOr("ADMIN_EMAIL", "admin@tera.local")

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// devAdminPassword is the fixed password used only for the development
// seed (--seed=dev / APP_ENV=development), where the whole database is
// disposable. It is never used for a production seed.
const devAdminPassword = "admin123"

// adminPassword resolves the first admin's password. A production seed
// refuses to run without ADMIN_PASSWORD; a development seed falls back to a
// known password so a fresh checkout stays usable. Either way a random
// password is generated and printed once when nothing else is configured,
// so no build ever ships a usable default credential.
func adminPassword(dev bool) string {
	if v := os.Getenv("ADMIN_PASSWORD"); v != "" {
		return v
	}

	if !dev {
		log.Fatal("ADMIN_PASSWORD must be set to seed the admin user; refusing to create an admin account with a default password")
	}

	return devAdminPassword
}

// AdminUserSeeder mints the first admin account with a hashed password.
type AdminUserSeeder struct {
	DB *sql.DB
	// Dev marks a development seed, which may fall back to a known password.
	Dev bool
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

	plain := adminPassword(s.Dev)
	hash, err := password.Hash(plain)
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

	if plain == devAdminPassword {
		log.Printf("admin user seeded with the development password %q; set ADMIN_PASSWORD to override", devAdminPassword)
		return
	}
	log.Printf("admin user seeded for %s; the password came from ADMIN_PASSWORD", adminEmail)
}
