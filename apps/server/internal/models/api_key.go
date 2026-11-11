package models

import (
	"slices"
	"strings"
	"time"
	"unicode"
)

// Key scopes name the gateway endpoint families an API key may call.
const (
	KeyScopeChat       = "chat"       // chat completions, messages, responses
	KeyScopeWeb        = "web"        // search, web fetch
	KeyScopeAudio      = "audio"      // speech, transcriptions
	KeyScopeImages     = "images"     // image generations
	KeyScopeEmbeddings = "embeddings" // embeddings
	// KeyScopeAll grants every family, the same as leaving scopes empty.
	KeyScopeAll = "*"
)

var keyScopes = []string{KeyScopeChat, KeyScopeWeb, KeyScopeAudio, KeyScopeImages, KeyScopeEmbeddings, KeyScopeAll}

func splitScopes(scopes string) []string {
	return strings.FieldsFunc(scopes, func(r rune) bool { return r == ',' || unicode.IsSpace(r) })
}

// UnknownKeyScope returns the first entry of a scopes string that names no
// scope, or "" when every entry is known.
func UnknownKeyScope(scopes string) string {
	for _, s := range splitScopes(scopes) {
		if !slices.Contains(keyScopes, s) {
			return s
		}
	}
	return ""
}

// APIKey is a stored inbound credential. The plaintext is never persisted.
type APIKey struct {
	ID         string  `json:"id"`
	UserID     *string `json:"user_id"`
	PlanID     *string `json:"plan_id"`
	Name       string  `json:"name"`
	KeyHash    string  `json:"-"`
	LookupHash string  `json:"-"`
	Display    string  `json:"display"`
	// Scopes is a space- or comma-separated list of key scopes. Empty means
	// the key may call every endpoint family.
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

// HasScope reports whether the key may call the endpoints under scope. An
// entry that names no scope grants nothing, so a typo restricts rather than
// opens the key.
func (k APIKey) HasScope(scope string) bool {
	granted := splitScopes(k.Scopes)
	return len(granted) == 0 || slices.Contains(granted, KeyScopeAll) || slices.Contains(granted, scope)
}
