package dtos

import "tera-router/server/internal/lib/validator"

// Account is the account create/update request body
// (POST/PUT/PATCH /v1/accounts). Credential fields are sealed at rest.
type Account struct {
	Provider    string         `json:"provider"`
	Label       string         `json:"label"`
	AuthKind    string         `json:"auth_kind"`
	APIKey      string         `json:"api_key"`
	Token       string         `json:"token"`
	Refresh     string         `json:"refresh"`
	Metadata    map[string]any `json:"metadata"`
	Priority    int            `json:"priority"`
	ProxyPoolID string         `json:"proxy_pool_id"`
	Disabled    *bool          `json:"disabled"`
}

func (d *Account) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
	v.Field("auth_kind").WithinS("api_key", "oauth", "none")
}

// BulkAccounts is the bulk credential import body (POST /v1/accounts/bulk).
type BulkAccounts struct {
	Accounts []Account `json:"accounts"`
}

func (d *BulkAccounts) Validate(v *validator.MapValidator) {
	// Items are validated individually in the service layer.
}

// ValidateKey is the pre-save credential probe body (POST /v1/validate-key).
type ValidateKey struct {
	Provider string         `json:"provider"`
	APIKey   string         `json:"api_key"`
	Metadata map[string]any `json:"metadata"`
}

func (d *ValidateKey) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
	v.Field("api_key").Required().String()
}
