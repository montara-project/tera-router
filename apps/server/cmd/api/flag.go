package main

import (
	"errors"
	"flag"
	"io/fs"
	"log"
	"net/netip"
	"os"
	"strconv"
	"strings"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
)

// Every flag defaults to its environment variable, so `make run` (which exports
// .env) and the container (which sets env) need no argument list; an explicit
// flag still wins over the environment.

// envBad records env vars whose value failed to parse. The failure is only
// fatal after flag.Parse() when the flag was not explicitly provided — a
// flag always wins over the environment, even a malformed one.
var envBad []envBadEntry

type envBadEntry struct{ key, flagName string }

// envString treats an env var that is set but empty as unset, so
// DATABASE_PATH= cannot blank the default path; an intentionally empty value
// needs the flag itself (e.g. --cors-allowed-origins=).
func envString(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func envBool(key, flagName string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		envBad = append(envBad, envBadEntry{key, flagName})
		return fallback
	}
	return b
}

func envInt(key, flagName string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		envBad = append(envBad, envBadEntry{key, flagName})
		return fallback
	}
	return n
}

func envUint(key, flagName string, fallback uint) uint {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.ParseUint(v, 10, 0)
	if err != nil {
		envBad = append(envBad, envBadEntry{key, flagName})
		return fallback
	}
	return uint(n)
}

func parseFlag(cfg *config.Config) {
	var machineID uint

	// App
	flag.UintVar(&machineID, "machine-id", envUint("MACHINE_ID", "machine-id", 0), "Machine ID")
	flag.StringVar(&cfg.App.Env, "env", envString("ENV", "development"), "Environment")
	flag.BoolVar(&cfg.App.Debug, "debug", envBool("DEBUG", "debug", false), "Debug mode")
	flag.IntVar(&cfg.App.Port, "port", envInt("PORT", "port", 8080), "Port")
	flag.StringVar(&cfg.App.Name, "app-name", envString("APP_NAME", "tera-router-server"), "App Name")
	// APP_SECRET in the environment keeps the secret out of the process
	// arguments, which any local user can read with ps.
	flag.StringVar(&cfg.App.Secret, "app-secret", envString("APP_SECRET", ""), "App Secret")
	// Wildcard CORS is a development convenience: everywhere else the default
	// stays empty so browsers enforce same-origin until origins are listed.
	// (cfg.App.Env is already populated — flag defaults bind in order — but
	// --env on the command line is parsed later, so only the ENV var steers
	// this default.)
	corsDefault := ""
	if cfg.App.Env == "development" {
		corsDefault = "*"
	}
	flag.StringVar(&cfg.App.CORSAllowedOrigins, "cors-allowed-origins", envString("CORS_ALLOWED_ORIGINS", corsDefault), "CORS Allowed Origins")
	// API_URL in the environment reaches the served web UI at runtime — no
	// rebuild — when the dashboard API lives on a different origin.
	flag.StringVar(&cfg.App.APIURL, "api-url", envString("API_URL", ""), "Public API base URL for the served web UI")
	flag.StringVar(&cfg.App.RateLimitExemptIPs, "rate-limit-exempt-ips", envString("RATE_LIMIT_EXEMPT_IPS", ""), "Comma-separated client IPs exempt from the rate limiter")
	flag.StringVar(&cfg.App.TrustedProxies, "trusted-proxies", envString("TRUSTED_PROXIES", ""), "Comma-separated IPs/CIDRs trusted to supply X-Forwarded-For (e.g. the reverse proxy's address)")

	// Database
	flag.StringVar(&cfg.Database.Path, "database-path", envString("DATABASE_PATH", database.DefaultPath), "SQLite database file path")
	flag.BoolVar(&cfg.Database.MigrateOnBoot, "migrate-on-boot", envBool("MIGRATE_ON_BOOT", "migrate-on-boot", false), "Apply pending migrations before starting the server")
	flag.BoolVar(&cfg.Database.SeedOnBoot, "seed-on-boot", envBool("SEED_ON_BOOT", "seed-on-boot", false), "Run baseline seeders after migrating on boot")

	// Sentry
	flag.StringVar(&cfg.Sentry.Dsn, "sentry-dsn", envString("SENTRY_DSN", ""), "Sentry DSN")

	// OIDC dashboard SSO; enabled only when all three are set.
	flag.StringVar(&cfg.OIDC.Issuer, "oidc-issuer", envString("OIDC_ISSUER", ""), "OIDC issuer base URL (Pocket ID, Keycloak, …)")
	flag.StringVar(&cfg.OIDC.ClientID, "oidc-client-id", envString("OIDC_CLIENT_ID", ""), "OIDC client ID")
	flag.StringVar(&cfg.OIDC.ClientSecret, "oidc-client-secret", envString("OIDC_CLIENT_SECRET", ""), "OIDC client secret")
	flag.StringVar(&cfg.OIDC.ProviderName, "oidc-provider-name", envString("OIDC_PROVIDER_NAME", ""), "OIDC provider display name on the login button (e.g. \"Pocket ID\")")
	flag.StringVar(&cfg.OIDC.RedirectURL, "oidc-redirect-url", envString("OIDC_REDIRECT_URL", ""), "OIDC callback URL registered at the provider; derived from the request when empty")
	flag.BoolVar(&cfg.OIDC.RequireEmailVerified, "oidc-require-email-verified", envBool("OIDC_REQUIRE_EMAIL_VERIFIED", "oidc-require-email-verified", true), "Refuse OIDC sign-ins whose email the provider has not verified")
	flag.BoolVar(&cfg.OIDC.DisablePasswordLogin, "oidc-disable-password-login", envBool("OIDC_DISABLE_PASSWORD_LOGIN", "oidc-disable-password-login", false), "Refuse password sign-in while OIDC SSO is enabled")
	flag.BoolVar(&cfg.OIDC.LinkExistingAccounts, "oidc-link-existing-accounts", envBool("OIDC_LINK_EXISTING_ACCOUNTS", "oidc-link-existing-accounts", true), "Let an OIDC sign-in link itself to an existing account with the same email")
	flag.BoolVar(&cfg.OIDC.AutoProvision, "oidc-auto-provision", envBool("OIDC_AUTO_PROVISION", "oidc-auto-provision", true), "Create a \"user\" account for an OIDC sign-in whose email matches none")

	flag.Parse()

	// A malformed env value is fatal unless the operator overrode it with a
	// flag — the flag wins over the environment.
	set := map[string]bool{}
	flag.Visit(func(f *flag.Flag) { set[f.Name] = true })
	for _, bad := range envBad {
		if !set[bad.flagName] {
			log.Fatalf("env %s: malformed value", bad.key)
		}
		log.Printf("env %s: malformed value ignored; --%s wins", bad.key, bad.flagName)
	}

	uint16Max := uint(1<<16 - 1)
	if machineID > uint16Max {
		log.Fatal("flag machine-id can only handle uint16")
	}

	cfg.App.MachineID = uint16(machineID)

	validateFlag(cfg)
}

// minSecretLen is the shortest app secret a new install may start with.
const minSecretLen = 32

func validateFlag(cfg *config.Config) {
	if cfg.App.Env == "" {
		log.Println("flag environment is marked as local")
	}

	if cfg.App.MachineID == 0 {
		log.Fatal("flag machine-id must be provided and cannot be 0")
	}

	if cfg.App.Secret == "" {
		log.Fatal("flag app-secret must be provided")
	}
	if cfg.Database.Path == "" {
		log.Fatal("flag database-path must not be empty")
	}

	// The secret signs session tokens (HS256) and derives the key sealing
	// every stored credential, so a short one can be brute-forced offline from
	// a single leaked token. A new install — no database yet — refuses to
	// start with one. An existing install only gets the warning: rotating the
	// secret makes every sealed credential unreadable, so refusing to boot
	// would strand it.
	// ponytail: "no database file" is the new-install signal, so a database
	// created beforehand by cmd/migrate skips the refusal and gets the warning.
	if len(cfg.App.Secret) < minSecretLen {
		if _, err := os.Stat(cfg.Database.Path); errors.Is(err, fs.ErrNotExist) {
			log.Fatalf("flag app-secret is %d characters; a new install needs at least %d random characters (openssl rand -base64 48)", len(cfg.App.Secret), minSecretLen)
		}
		log.Printf("WARNING: app-secret is %d characters; it can be brute-forced offline. Move to a secret of at least %d random characters (openssl rand -base64 48): export a portable configuration backup, start a fresh install with the new secret and import it there", len(cfg.App.Secret), minSecretLen)
	}

	// Entries feed fiber.TrustProxyConfig.Proxies — a malformed one panics in
	// fiber.New, so reject it here with a readable flag error.
	for _, p := range strings.Split(cfg.App.TrustedProxies, ",") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, err := netip.ParseAddr(p); err != nil {
			if _, err := netip.ParsePrefix(p); err != nil {
				log.Fatalf("flag trusted-proxies: %q is not an IP address or CIDR", p)
			}
		}
	}
}
