package main

import (
	"errors"
	"flag"
	"io/fs"
	"log"
	"net/netip"
	"os"
	"strings"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
)

// debugFromEnv is the default for the -debug flag, so DEBUG=true enables
// query logging in deployments that configure through the environment.
func debugFromEnv() bool {
	v := os.Getenv("DEBUG")
	return v == "true" || v == "1"
}

func parseFlag(cfg *config.Config) {
	var machineID uint

	// App
	flag.UintVar(&machineID, "machine-id", 0, "Machine ID")
	flag.StringVar(&cfg.App.Env, "env", "development", "Environment")
	flag.BoolVar(&cfg.App.Debug, "debug", debugFromEnv(), "Debug mode (also enabled by DEBUG=true)")
	flag.IntVar(&cfg.App.Port, "port", 8080, "Port")
	flag.StringVar(&cfg.App.Name, "app-name", "tera-router-server", "App Name")
	// APP_SECRET in the environment keeps the secret out of the process
	// arguments, which any local user can read with ps.
	flag.StringVar(&cfg.App.Secret, "app-secret", os.Getenv("APP_SECRET"), "App Secret (also read from APP_SECRET)")
	flag.StringVar(&cfg.App.CORSAllowedOrigins, "cors-allowed-origins", "*", "CORS Allowed Origins")
	// API_URL in the environment reaches the served web UI at runtime — no
	// rebuild — when the dashboard API lives on a different origin.
	flag.StringVar(&cfg.App.APIURL, "api-url", os.Getenv("API_URL"), "Public API base URL for the served web UI (also read from API_URL)")
	flag.StringVar(&cfg.App.RateLimitExemptIPs, "rate-limit-exempt-ips", "", "Comma-separated client IPs exempt from the rate limiter")
	flag.StringVar(&cfg.App.TrustedProxies, "trusted-proxies", "", "Comma-separated IPs/CIDRs trusted to supply X-Forwarded-For (e.g. the reverse proxy's address)")

	// Database
	flag.StringVar(&cfg.Database.Path, "database-path", database.DefaultPath, "SQLite database file path")
	flag.BoolVar(&cfg.Database.MigrateOnBoot, "migrate-on-boot", false, "Apply pending migrations before starting the server")
	flag.BoolVar(&cfg.Database.SeedOnBoot, "seed-on-boot", false, "Run baseline seeders after migrating on boot")

	// Sentry
	flag.StringVar(&cfg.Sentry.Dsn, "sentry-dsn", "", "Sentry DSN")

	flag.Parse()

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
