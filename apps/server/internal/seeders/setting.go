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
	settings := `{"rtk_enabled":true,"source_code_filter":"off","caveman_enabled":false,"terse_enabled":false,
"headroom_enabled":false,"ponytail_enabled":false,"provider_round_robin":true,"provider_sticky_limit":3,
"chain_round_robin":false,"connect_timeout":60,"stream_stall_timeout":300,"request_timeout":300,
"enforce_rate_limits":true,"outbound_proxy_enabled":false,"request_detail_recording":true,
"branding_display_name":"Tera Router","branding_tagline":"","branding_theme":"forest-amber"}`

	if _, err := s.DB.Exec(`
		INSERT INTO settings (key, value) VALUES ('app', $1)
		ON CONFLICT (key) DO NOTHING`, settings); err != nil {
		log.Fatalf("seed settings: %v", err)
	}
}
