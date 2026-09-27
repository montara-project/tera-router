// Package apikey mints inbound API keys with the `kr_` prefix the dashboard
// expects. The plaintext is never persisted: creation returns it once, while
// the store keeps an argon2id verifier, a fast SHA-256 lookup index, a masked
// display form, and an envelope-encrypted copy for explicit reveal requests.
package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Prefix is the human-visible prefix on every issued key.
const Prefix = "sk_tr_"

// secretBytes is the entropy of the random portion of an API key.
const secretBytes = 24

// argon2 parameters tuned for interactive verification on commodity hardware.
const (
	argonTime    = 1
	argonMemory  = 64 * 1024 // 64 MiB
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16
)

// ErrInvalidHash is returned when a stored hash cannot be parsed.
var ErrInvalidHash = errors.New("apikey: invalid argon2 hash")

// Generated is the result of minting a new API key. Plaintext is shown to the
// user exactly once and never persisted; only Hash and Lookup are stored.
type Generated struct {
	// Plaintext is the full key string the caller uses (e.g. "kr_AbC123...").
	Plaintext string
	// Hash is the argon2id verifier stored in the database.
	Hash string
	// Lookup is a fast, non-reversible index (SHA-256 of the plaintext) used to
	// find the candidate row before running the expensive argon2 comparison.
	Lookup string
	// Display is a masked form safe to show in listings (e.g. "kr_AbC1…7xQ2").
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

	hash, err := Hash(plaintext)
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

// Hash produces an argon2id PHC-style hash of the key.
func Hash(plaintext string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	digest := argon2.IDKey([]byte(plaintext), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(digest),
	), nil
}

// Verify reports whether plaintext matches the stored argon2id hash, using a
// constant-time comparison.
func Verify(plaintext, encodedHash string) (bool, error) {
	mem, time, threads, salt, want, err := parseArgon2Hash(encodedHash)
	if err != nil {
		return false, err
	}
	got := argon2.IDKey([]byte(plaintext), salt, time, mem, threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
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

func parseArgon2Hash(encoded string) (mem, time uint32, threads uint8, salt, hash []byte, err error) {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=...,t=...,p=...", salt, hash]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return 0, 0, 0, nil, nil, ErrInvalidHash
	}
	var version int
	if _, err = fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return 0, 0, 0, nil, nil, ErrInvalidHash
	}
	if _, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &mem, &time, &threads); err != nil {
		return 0, 0, 0, nil, nil, ErrInvalidHash
	}
	if salt, err = base64.RawStdEncoding.DecodeString(parts[4]); err != nil {
		return 0, 0, 0, nil, nil, fmt.Errorf("%w: salt: %v", ErrInvalidHash, err)
	}
	if hash, err = base64.RawStdEncoding.DecodeString(parts[5]); err != nil {
		return 0, 0, 0, nil, nil, fmt.Errorf("%w: digest: %v", ErrInvalidHash, err)
	}
	return mem, time, threads, salt, hash, nil
}
