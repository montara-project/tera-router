// Package models holds the domain entities persisted by the server. The
// shapes mirror the Postgres schema in migrations/ and follow the IDRouter
// domain model (API keys, plans, accounts, chains, budgets, usage).
package models

import "time"

type Role struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Role) TableName() string { return "roles" }

type User struct {
	ID           string     `json:"id"`
	Fullname     string     `json:"fullname"`
	Email        string     `json:"email"`
	Phone        *string    `json:"phone"`
	Address      *string    `json:"address"`
	TokenVerify  *string    `json:"token_verify"`
	PasswordHash string     `json:"-"`
	IsActive     bool       `json:"is_active"`
	IsBlocked    bool       `json:"is_blocked"`
	RoleID       string     `json:"role_id"`
	Role         Role       `json:"role"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
}

// TableName returns the backing table for the model.
func (User) TableName() string { return "users" }

// RefreshToken stores only the sha-256 hash of the opaque refresh token.
type RefreshToken struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at"`
	CreatedAt time.Time  `json:"created_at"`
}

// TableName returns the backing table for the model.
func (RefreshToken) TableName() string { return "refresh_tokens" }

// AuthKind classifies how an account authenticates upstream.
type AuthKind string

const (
	AuthAPIKey AuthKind = "api_key"
	AuthOAuth  AuthKind = "oauth"
	AuthNone   AuthKind = "none"
)

// Sealed holds the envelope-encrypted pair for one secret blob.
type Sealed struct {
	WrappedDEK string `json:"wrapped_dek"`
	Ciphertext string `json:"ciphertext"`
}

// Empty reports whether the pair carries no recoverable secret.
func (s Sealed) Empty() bool { return s.WrappedDEK == "" || s.Ciphertext == "" }

// CustomProvider is an operator-registered OpenAI-compatible upstream.
type CustomProvider struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	BaseURL   string    `json:"base_url"`
	APIKind   string    `json:"api_kind"`
	Pricing   string    `json:"pricing"` // raw JSON
	Enabled   bool      `json:"enabled"`
	Priority  int       `json:"priority"`
	Metadata  string    `json:"metadata"` // raw JSON
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (CustomProvider) TableName() string { return "custom_providers" }

// Account holds an upstream provider credential. Secret material is stored
// as envelope-encrypted blobs; plaintext is never persisted.
type Account struct {
	ID             string     `json:"id"`
	Provider       string     `json:"provider"`
	Label          string     `json:"label"`
	AuthKind       AuthKind   `json:"auth_kind"`
	Secret         Sealed     `json:"-"`
	KeyFingerprint string     `json:"key_fingerprint"`
	KeyHash        string     `json:"-"`
	Token          Sealed     `json:"-"`
	Refresh        Sealed     `json:"-"`
	TokenExpiresAt *time.Time `json:"token_expires_at"`
	Metadata       string     `json:"metadata"` // raw JSON
	Priority       int        `json:"priority"`
	Disabled       bool       `json:"disabled"`
	ProxyPoolID    *string    `json:"proxy_pool_id"`
	NeedsReconnect bool       `json:"needs_reconnect"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Account) TableName() string { return "accounts" }

// APIKey is a stored inbound credential. The plaintext is never persisted.
type APIKey struct {
	ID         string     `json:"id"`
	UserID     *string    `json:"user_id"`
	PlanID     *string    `json:"plan_id"`
	Name       string     `json:"name"`
	KeyHash    string     `json:"-"`
	LookupHash string     `json:"-"`
	Display    string     `json:"display"`
	Scopes     string     `json:"scopes"`
	Disabled   bool       `json:"disabled"`
	LastUsedAt *time.Time `json:"last_used_at"`
	Secret     Sealed     `json:"-"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (APIKey) TableName() string { return "api_keys" }

// Plan is a reusable template for budget limits and model restrictions.
type Plan struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	LimitMicros   int64     `json:"limit_micros"`
	LimitTokens   int64     `json:"limit_tokens"`
	Period        string    `json:"period"`
	AlertPct      int       `json:"alert_pct"`
	HardCutoff    bool      `json:"hard_cutoff"`
	AllowedModels []string  `json:"allowed_models"`
	RPM           *int      `json:"rpm"`
	TPM           *int      `json:"tpm"`
	Concurrent    *int      `json:"concurrent"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Plan) TableName() string { return "plans" }

type Chain struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	Strategy         string      `json:"strategy"`
	FallbackProvider string      `json:"fallback_provider"`
	FallbackModel    string      `json:"fallback_model"`
	ContextWindow    int         `json:"context_window"`
	Enabled          bool        `json:"enabled"`
	Steps            []ChainStep `json:"steps"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Chain) TableName() string { return "chains" }

// ChainStep is one candidate target within a chain.
type ChainStep struct {
	ID        string    `json:"id"`
	ChainID   string    `json:"chain_id"`
	Position  int       `json:"position"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (ChainStep) TableName() string { return "chain_steps" }

// ModelAlias is a model alias pool: one bare name mapping to an ordered list
// of provider/model targets.
type ModelAlias struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	ContextWindow int           `json:"context_window"`
	Active        bool          `json:"active"`
	Targets       []AliasTarget `json:"targets"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (ModelAlias) TableName() string { return "model_aliases" }

// AliasTarget is one ordered candidate within a model alias pool.
type AliasTarget struct {
	ID       string `json:"id"`
	AliasID  string `json:"alias_id"`
	Position int    `json:"position"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Active   bool   `json:"active"`
}

// TableName returns the backing table for the model.
func (AliasTarget) TableName() string { return "alias_targets" }

// BudgetScope identifies what a budget applies to.
type BudgetScope string

const (
	ScopeTenant  BudgetScope = "tenant"
	ScopeAPIKey  BudgetScope = "api_key"
	ScopeAccount BudgetScope = "account"
)

// Budget enforces a spend and/or token limit over a period.
type Budget struct {
	ID              string      `json:"id"`
	ScopeKind       BudgetScope `json:"scope_kind"`
	ScopeID         string      `json:"scope_id"`
	LimitMicros     int64       `json:"limit_micros"`
	LimitTokens     int64       `json:"limit_tokens"`
	Period          string      `json:"period"`
	AlertPct        int         `json:"alert_pct"`
	HardCutoff      bool        `json:"hard_cutoff"`
	RemainingTokens int64       `json:"remaining_tokens"`
	RemainingMicros int64       `json:"remaining_micros"`
	PeriodBucket    string      `json:"period_bucket"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Budget) TableName() string { return "budgets" }

// UsageRecord meters one completed request.
type UsageRecord struct {
	ID               int64     `json:"id"`
	APIKeyID         *string   `json:"api_key_id"`
	AccountID        *string   `json:"account_id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	Client           string    `json:"client"`
	ClientIP         string    `json:"client_ip"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	CachedTokens     int       `json:"cached_tokens"`
	CacheWriteTokens int       `json:"cache_write_tokens"`
	ReasoningTokens  int       `json:"reasoning_tokens"`
	CostMicros       int64     `json:"cost_micros"`
	CacheHit         bool      `json:"cache_hit"`
	LatencyMS        int       `json:"latency_ms"`
	TTFTMS           int       `json:"ttft_ms"`
	Failed           bool      `json:"failed"`
	ErrorKind        string    `json:"error_kind"`
	ErrorStatus      int       `json:"error_status"`
	ErrorMessage     string    `json:"error_message"`
	CreatedAt        time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (UsageRecord) TableName() string { return "usage_records" }

// ProxyPool is an outbound proxy definition.
type ProxyPool struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	URL          string     `json:"url"`
	Mode         string     `json:"mode"`
	Label        string     `json:"label"`
	Status       string     `json:"status"`
	LastTestedAt *time.Time `json:"last_tested_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (ProxyPool) TableName() string { return "proxy_pools" }

// Skill is a reusable prompt snippet managed from the dashboard.
type Skill struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Prompt      string    `json:"prompt"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Skill) TableName() string { return "skills" }

// Setting is one settings kv row; Value is raw JSON.
type Setting struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"` // raw JSON
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Setting) TableName() string { return "settings" }

// AuditEntry is one append-only audit record.
type AuditEntry struct {
	ID        string    `json:"id"`
	Actor     string    `json:"actor"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Detail    string    `json:"detail"` // raw JSON
	CreatedAt time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (AuditEntry) TableName() string { return "audit_entries" }

// PricingOverride sets per-provider/model rates in micros (millionths of a
// dollar per million tokens).
type PricingOverride struct {
	ID               string    `json:"id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	InputMicros      int64     `json:"input_micros"`
	OutputMicros     int64     `json:"output_micros"`
	CacheReadMicros  int64     `json:"cache_read_micros"`
	CacheWriteMicros int64     `json:"cache_write_micros"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (PricingOverride) TableName() string { return "model_pricing_overrides" }

// CapabilityOverride forces the capability set for a provider/model pair.
type CapabilityOverride struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	Model        string    `json:"model"`
	Capabilities []string  `json:"capabilities"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (CapabilityOverride) TableName() string { return "model_capability_overrides" }
