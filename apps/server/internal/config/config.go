// Package config holds the runtime configuration assembled from CLI flags.
package config

// EnvDevelopment is the App.Env value that enables development-only behaviour
// such as seeding the sample API key on boot.
const EnvDevelopment = "development"

type Config struct {
	App      ConfigApp
	Database ConfigDatabase
	Sentry   ConfigSentry
}

type ConfigApp struct {
	Env                string
	Debug              bool
	Port               int
	MachineID          uint16
	Name               string
	Secret             string
	CORSAllowedOrigins string
	// RateLimitExemptIPs is a comma-separated list of client IPs that skip the
	// dashboard rate limiter entirely.
	RateLimitExemptIPs string
}

type ConfigDatabase struct {
	// Path is the SQLite database file (default terarouter.db).
	Path string
	// MigrateOnBoot applies pending SQL migrations before the server starts.
	MigrateOnBoot bool
	// SeedOnBoot runs the idempotent baseline seeders after migrating.
	SeedOnBoot bool
}

type ConfigSentry struct {
	Dsn string
}
