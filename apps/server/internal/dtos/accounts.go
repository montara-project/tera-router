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

// TestResult reports one credential validation attempt against the upstream.
type TestResult struct {
	OK        bool   `json:"ok"`
	Status    int    `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Detail    string `json:"detail"`
}
