// Package apikey mints inbound API keys with the `sk_tr_` prefix the
// dashboard expects. The plaintext is never persisted: creation returns it
// once, while the store keeps an argon2id verifier, a fast SHA-256 lookup
// index, a masked display form, and an envelope-encrypted copy for explicit
// reveal requests. Hashing and verification reuse lib/password (same
// argon2id parameters).
package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"strings"

	"tera-router/server/internal/lib/password"
)

// Prefix is the human-visible prefix on every issued key.
const Prefix = "sk_tr_"

// secretBytes is the entropy of the random portion of an API key.
const secretBytes = 24

// Generated is the result of minting a new API key. Plaintext is shown to the
// user exactly once and never persisted; only Hash and Lookup are stored.
type Generated struct {
	// Plaintext is the full key string the caller uses.
	Plaintext string
	// Hash is the argon2id verifier stored in the database.
	Hash string
	// Lookup is a fast, non-reversible index (SHA-256 of the plaintext) used to
	// find the candidate row before running the expensive argon2 comparison.
	Lookup string
	// Display is a masked form safe to show in listings.
	Display string
}

// Generate mints a new API key, returning the plaintext plus its stored
// verifier. The plaintext is unrecoverable afterward.
func Generate() (Generated, error) {
	raw := make([]byte, secretBytes)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return Generated{}, fmt.Errorf("generate key entropy: %w", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(raw)
	plaintext := Prefix + secret

	hash, err := password.Hash(plaintext)
	if err != nil {
		return Generated{}, err
	}

	return Generated{
		Plaintext: plaintext,
		Hash:      hash,
		Lookup:    LookupHash(plaintext),
		Display:   Mask(plaintext),
	}, nil
}

// Verify reports whether plaintext matches the stored argon2id hash.
func Verify(plaintext, encodedHash string) (bool, error) {
	return password.Verify(plaintext, encodedHash)
}

// LookupHash returns a deterministic SHA-256 hex index for a key. It is used
// only to locate the candidate record; argon2 still gates verification.
func LookupHash(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Mask renders a key for display, revealing only a short head and tail.
func Mask(plaintext string) string {
	body := strings.TrimPrefix(plaintext, Prefix)
	if len(body) <= 8 {
		return Prefix + "…"
	}
	return fmt.Sprintf("%s%s…%s", Prefix, body[:4], body[len(body)-4:])
}
