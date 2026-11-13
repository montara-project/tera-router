package dtos

import "tera-router/server/internal/lib/validator"

// Account is the account create/update request body
// (POST/PATCH /v1/accounts). Credential fields are sealed at rest.
type Account struct {
	Provider string `json:"provider"`
	AuthKind string `json:"auth_kind"`
	APIKey   string `json:"api_key"`
	Token    string `json:"token"`
	Refresh  string `json:"refresh"`
	// Pointer fields distinguish "absent" from "explicitly cleared" on PATCH:
	// only nil keeps the stored value, so an update can set priority 0,
	// empty the label, or detach the proxy pool with "".
	Label       *string        `json:"label"`
	Metadata    map[string]any `json:"metadata"`
	Priority    *int           `json:"priority"`
	ProxyPoolID *string        `json:"proxy_pool_id"`
	Disabled    *bool          `json:"disabled"`
	// Password and OTP re-authenticate an update that points the stored
	// credential at a new metadata.base_url; see Reauth.
	Password     string `json:"password"`
	ReauthTicket string `json:"reauth_ticket"`
	OTP          string `json:"otp"`
}

func (d *Account) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
	v.Field("auth_kind").WithinS("api_key", "oauth", "none")
}

// AccountBulk is the bulk add request body (POST /v1/accounts/bulk): one
// API-key account is created per entry of APIKeys, labelled
// "<label_prefix> <n>", all sharing the remaining fields.
type AccountBulk struct {
	Provider    string         `json:"provider"`
	APIKeys     []string       `json:"api_keys"`
	LabelPrefix string         `json:"label_prefix"`
	Priority    int            `json:"priority"`
	ProxyPoolID string         `json:"proxy_pool_id"`
	Metadata    map[string]any `json:"metadata"`
}

func (d *AccountBulk) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
}

// AccountsExport is the body of POST /v1/providers/:id/accounts/export. The
// passphrase re-keys every credential in the file so another install can
// import it; Password and OTP re-authenticate the export (see Reauth).
type AccountsExport struct {
	Passphrase   string `json:"passphrase"`
	Password     string `json:"password"`
	OTP          string `json:"otp"`
	ReauthTicket string `json:"reauth_ticket"`
}

func (d *AccountsExport) Validate(v *validator.MapValidator) {
	v.Field("passphrase").Required().String()
	v.Field("password").String() // empty can reauthenticate via a fresh SSO reauth ticket
}

// TestResult reports one credential validation attempt against the upstream.
type TestResult struct {
	OK        bool   `json:"ok"`
	Status    int    `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Detail    string `json:"detail"`
}
