// Package config holds the runtime configuration assembled from CLI flags.
package config

import "strings"

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
	// RestrictedAccessDisabled ignores the stored restricted access period
	// without touching it — the way back in after locking yourself out.
	RestrictedAccessDisabled bool
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
	// RequireEmailVerified refuses id_tokens whose email the provider has not
	// verified. Keep it on unless the provider never sends email_verified.
	RequireEmailVerified bool
	// DisablePasswordLogin refuses every non-SSO sign-in — POST /auth/sign-in
	// and the public passkey endpoints — so SSO is the only way in. It only
	// applies while SSO itself is enabled — without a working provider it
	// would lock every account out.
	DisablePasswordLogin bool
	// LinkExistingAccounts lets an OIDC sign-in attach its subject to an
	// existing account with the same email. Off means only accounts that
	// already carry an oidc_sub (provisioned or previously linked) may use
	// SSO; the rest keep password/passkey sign-in.
	LinkExistingAccounts bool
	// AutoProvision lets an OIDC sign-in whose verified email matches no
	// account create one with the "user" role. Turn it off when accounts
	// must be created by an admin first; linked and email-matched accounts
	// are unaffected — those are governed by LinkExistingAccounts.
	AutoProvision bool
	// AllowedDomains, comma-separated, limits SSO to emails at the listed
	// domains — including sign-ins whose pair is already linked. Empty
	// means every domain the provider vouches for.
	AllowedDomains string
}

// Enabled reports whether SSO is configured: all three provider fields set.
func (c ConfigOIDC) Enabled() bool {
	return c.Issuer != "" && c.ClientID != "" && c.ClientSecret != ""
}

// EmailDomainAllowed checks an email against the comma-separated domain
// allowlist; an empty list allows everything.
func (c ConfigOIDC) EmailDomainAllowed(email string) bool {
	if strings.TrimSpace(c.AllowedDomains) == "" {
		return true
	}
	_, domain, ok := strings.Cut(strings.ToLower(strings.TrimSpace(email)), "@")
	if !ok {
		return false
	}
	for d := range strings.SplitSeq(c.AllowedDomains, ",") {
		if domain == strings.ToLower(strings.TrimSpace(d)) {
			return true
		}
	}
	return false
}
