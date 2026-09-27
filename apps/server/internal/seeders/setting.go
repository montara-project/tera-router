package seeders

import (
	"database/sql"
	"log"
)

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
