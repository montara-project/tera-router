// Package oauth implements the OAuth flows tera-router uses to connect
// subscription/OAuth providers — currently Anthropic (claude) and OpenAI
// (codex) — without an API key, ported from the IDRouter reference
// (internal/oauth).
//
// Both providers use Authorization Code + PKCE: the dashboard asks the server
// for a provider authorize URL (POST /v1/oauth/:provider/authorize), the user
// signs in on the provider's official web and is sent back with a code, and
// the code is exchanged for tokens (POST /v1/oauth/:provider/exchange, or
// automatically via the fixed loopback listener for Codex). Tokens are sealed
// into an account record; expired access tokens are refreshed on demand from
// the stored refresh token.
package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

// FlowType discriminates the OAuth flow a provider uses.
type FlowType string

// FlowAuthCodePKCE is Authorization Code with PKCE (S256).
const FlowAuthCodePKCE FlowType = "authorization_code_pkce"

// PKCE holds a generated PKCE verifier/challenge pair plus a CSRF state.
type PKCE struct {
	Verifier  string
	Challenge string
	State     string
}

// GeneratePKCE produces a PKCE pair using the S256 method. bytes controls the
// verifier entropy (default 32).
func GeneratePKCE(bytes int) (PKCE, error) {
	if bytes <= 0 {
		bytes = 32
	}
	verifier, err := randomBase64URL(bytes)
	if err != nil {
		return PKCE{}, err
	}
	state, err := randomBase64URL(32)
	if err != nil {
		return PKCE{}, err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	return PKCE{Verifier: verifier, Challenge: challenge, State: state}, nil
}

// Tokens is the normalized result of an OAuth token exchange or refresh.
type Tokens struct {
	AccessToken  string
	RefreshToken string
	// IDToken is used transiently to derive labels/provider metadata. It is
	// not persisted because account metadata is stored as plaintext JSON.
	IDToken string
	// ExpiresIn is the access-token lifetime in seconds (0 if unknown).
	ExpiresIn int
	Scope     string
	// Email / DisplayName identify the connected account for the dashboard.
	Email       string
	DisplayName string
	// Extra carries provider-specific metadata to persist (e.g. Codex's
	// ChatGPT account id and plan type).
	Extra map[string]string
}

// randomBase64URL returns n random bytes encoded as unpadded base64url.
func randomBase64URL(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("oauth: read random: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
