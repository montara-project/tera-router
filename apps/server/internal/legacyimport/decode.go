// Package legacyimport reads a 9router or OmniRoute JSON backup and plans its
// translation into Tera Router rows: custom providers, accounts, API keys,
// proxy pools, chains (from combos) and model aliases.
//
// Both routers export the same document shape (OmniRoute's legacy JSON export
// is the 9router format plus a _meta block). 9router backups carry plaintext
// credentials; OmniRoute redacts them, so its accounts become disabled stubs
// and its API keys are not imported.
//
// The package is pure: it decodes and maps, and never touches the database.
// The handler seals secrets and persists the plan.
package legacyimport

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Source identifies the router that produced the backup.
type Source string

const (
	NineRouter Source = "9router"
	OmniRoute  Source = "omniroute"
)

// ParseSource validates a source name from the request path.
func ParseSource(s string) (Source, bool) {
	switch Source(s) {
	case NineRouter, OmniRoute:
		return Source(s), true
	}
	return "", false
}

// Connection is one providerConnections entry. Secrets live at the top level.
type Connection struct {
	ID                   string         `json:"id"`
	Provider             string         `json:"provider"`
	AuthType             string         `json:"authType"`
	Name                 string         `json:"name"`
	DisplayName          string         `json:"displayName"`
	Email                string         `json:"email"`
	Priority             int            `json:"-"`
	IsActive             *bool          `json:"isActive"`
	APIKey               string         `json:"apiKey"`
	AccessToken          string         `json:"accessToken"`
	RefreshToken         string         `json:"refreshToken"`
	ExpiresAt            *time.Time     `json:"-"`
	ProviderSpecificData map[string]any `json:"providerSpecificData"`

	RawPriority  any `json:"priority"`
	RawExpiresAt any `json:"expiresAt"`
}

// Node is one providerNodes entry: a user-defined OpenAI-/Anthropic-compatible
// upstream that connections reference by its id.
type Node struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Prefix  string `json:"prefix"`
	APIType string `json:"apiType"`
	BaseURL string `json:"baseUrl"`
}

// APIKey is one inbound key; 9router stores the plaintext.
type APIKey struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	Name     string `json:"name"`
	IsActive *bool  `json:"isActive"`
}

// Combo is a named, ordered model fallback list. Steps are "ref/model"
// strings or (OmniRoute) objects.
type Combo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Kind   string `json:"kind"`
	Models []any  `json:"models"`
}

// ProxyPool is one outbound proxy definition.
type ProxyPool struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ProxyURL    string `json:"proxyUrl"`
	Type        string `json:"type"`
	StrictProxy bool   `json:"strictProxy"`
	IsActive    *bool  `json:"isActive"`
}

// Backup is the decoded document.
type Backup struct {
	Connections  []Connection   `json:"providerConnections"`
	Nodes        []Node         `json:"providerNodes"`
	APIKeys      []APIKey       `json:"apiKeys"`
	Combos       []Combo        `json:"combos"`
	ProxyPools   []ProxyPool    `json:"proxyPools"`
	ModelAliases map[string]any `json:"modelAliases"`
}

// Decode parses a backup document. It rejects JSON that carries none of the
// collections a 9router/OmniRoute export has, so an unrelated file fails
// loudly instead of importing nothing.
func Decode(data []byte) (*Backup, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, errors.New("the backup file is empty")
	}
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(data, &probe); err != nil {
		return nil, fmt.Errorf("the backup is not a JSON object: %w", err)
	}
	found := false
	for _, k := range []string{"providerConnections", "providerNodes", "combos", "apiKeys"} {
		if _, ok := probe[k]; ok {
			found = true
		}
	}
	if !found {
		return nil, errors.New("no providerConnections, providerNodes, combos or apiKeys — is this a 9router/OmniRoute backup?")
	}

	var b Backup
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, fmt.Errorf("unexpected backup shape: %w", err)
	}
	for i := range b.Connections {
		c := &b.Connections[i]
		c.Priority = asInt(c.RawPriority)
		c.ExpiresAt = asTime(c.RawExpiresAt)
	}
	return &b, nil
}

// asInt reads a JSON number or numeric string; anything else is 0.
func asInt(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(t))
		return n
	}
	return 0
}

// asTime reads an RFC 3339 string or a Unix epoch in milliseconds.
func asTime(v any) *time.Time {
	switch t := v.(type) {
	case string:
		if ts, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(t)); err == nil {
			return &ts
		}
	case float64:
		if t > 0 {
			ts := time.UnixMilli(int64(t)).UTC()
			return &ts
		}
	}
	return nil
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}
