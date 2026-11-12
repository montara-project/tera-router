// Package config holds the runtime configuration assembled from CLI flags.
package config

// EnvDevelopment is the App.Env value that enables development-only behaviour
// such as seeding the sample API key on boot.
const EnvDevelopment = "development"

type Config struct {
	App      ConfigApp
	Database ConfigDatabase
	Sentry   ConfigSentry
	OIDC     ConfigOIDC
}

type ConfigApp struct {
	Env                string
	Debug              bool
	Port               int
	MachineID          uint16
	Name               string
	Secret             string
	CORSAllowedOrigins string
	// APIURL is injected into the served web UI as its API base URL. Empty
	// means same-origin — the usual setup where this server serves the UI.
	APIURL string
	// RateLimitExemptIPs is a comma-separated list of client IPs that skip the
	// dashboard rate limiter entirely.
	RateLimitExemptIPs string
	// TrustedProxies is a comma-separated list of proxy IPs/CIDRs whose
	// X-Forwarded-For header is honored when resolving the client IP.
	TrustedProxies string
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

// ConfigOIDC holds the generic OpenID Connect sign-in settings (Pocket ID,
// Keycloak, Authentik, …). Dashboard SSO is enabled only when all three are
// set; the issuer is the provider's base URL used for discovery.
type ConfigOIDC struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	ProviderName string
	RedirectURL  string
}
