package seeders

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"log"
	"os"

	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/password"

	"github.com/google/uuid"
)

// adminEmail and adminPassword seed the first dashboard account. Override
// them at migrate time via ADMIN_EMAIL / ADMIN_PASSWORD.
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

// SettingsSeeder seeds the typed settings document consumed by /v1/settings.
type SettingsSeeder struct {
	DB *sql.DB
}

func (s SettingsSeeder) Name() string { return "settings" }

func (s SettingsSeeder) Seed() {
	settings := `{"rtkEnabled":true,"sourceCodeFilter":"off","cavemanEnabled":false,"terseEnabled":false,
"headroomEnabled":false,"ponytailEnabled":false,"providerRoundRobin":true,"providerStickyLimit":3,
"chainRoundRobin":false,"connectTimeout":60,"streamStallTimeout":300,"requestTimeout":300,
"enforceRateLimits":true,"outboundProxyEnabled":false,"requestDetailRecording":true,
"brandingDisplayName":"Tera Router","brandingTagline":"","brandingTheme":"forest-amber"}`

	if _, err := s.DB.Exec(`
		INSERT INTO settings (key, value) VALUES ('app', $1::jsonb)
		ON CONFLICT (key) DO NOTHING`, settings); err != nil {
		log.Fatalf("seed settings: %v", err)
	}
}

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

// SampleKeySeeder mints one development key so a fresh database has a usable
// credential (mirrors the web mock's "Dev" key). Only runs with --seed dev.
type SampleKeySeeder struct {
	DB *sql.DB
}

func (s SampleKeySeeder) Name() string { return "sample_key" }

func (s SampleKeySeeder) Seed() {
	var exists bool
	if err := s.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM api_keys WHERE name = 'Dev')`).Scan(&exists); err != nil {
		log.Fatalf("check sample key: %v", err)
	}
	if exists {
		return
	}

	gen, err := apikey.Generate()
	if err != nil {
		log.Fatalf("generate sample key: %v", err)
	}
	lookup := sha256.Sum256([]byte(gen.Plaintext))

	_, err = s.DB.Exec(`
		INSERT INTO api_keys (id, plan_id, name, key_hash, lookup_hash, display, scopes)
		VALUES ($1, $2, 'Dev', $3, $4, $5, '')`,
		uuid.NewString(),
		uuid.MustParse("00000000-0000-0000-0000-000000000010"),
		gen.Hash, hex.EncodeToString(lookup[:]), gen.Display,
	)
	if err != nil {
		log.Fatalf("seed sample key: %v", err)
	}

	log.Printf("sample key plaintext (copy now): %s", gen.Plaintext)
}
