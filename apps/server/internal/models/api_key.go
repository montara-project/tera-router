package models

import "time"

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
	// AllowedModels narrows the assigned plan's allowlist for this key alone.
	// Empty means the key follows its plan.
	AllowedModels []string `json:"allowed_models"`
	// SkillIDs are the skills injected into this key's requests, on top of
	// the globally enabled ones.
	SkillIDs  []string  `json:"skill_ids"`
	Secret    Sealed    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
