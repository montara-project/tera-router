package sealer

import (
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

// Portable sealing lets a configuration backup move between installs that do
// NOT share an APP_SECRET. Instead of the master key, secrets are sealed under
// a key stretched from a user-supplied passphrase with argon2id; on import
// they are opened with the passphrase and re-sealed under the destination
// master key. The key is derived once per backup document (one salt), so
// sealing hundreds of credentials does not pay argon2 per secret. The
// passphrase itself is never stored.

// ErrEmptyPassphrase is returned when a portable sealer gets no passphrase.
var ErrEmptyPassphrase = errors.New("sealer: empty passphrase")

// argon2id cost for passphrase stretching (same profile as lib/password).
const (
	portableTime    = 1
	portableMemory  = 64 * 1024 // 64 MiB
	portableThreads = 4
	portableSaltLen = 16
)

// PortableSealer seals and opens secrets under one passphrase-derived key.
type PortableSealer struct {
	gcm  cipher.AEAD
	salt string
}

// NewPortable derives a fresh portable key from passphrase with a random salt.
func NewPortable(passphrase string) (*PortableSealer, error) {
	salt := make([]byte, portableSaltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, fmt.Errorf("generate salt: %w", err)
	}
	return portable(passphrase, salt)
}

// OpenPortable re-derives the portable key of an existing document from its
// passphrase and base64 salt.
func OpenPortable(passphrase, salt string) (*PortableSealer, error) {
	raw, err := base64.StdEncoding.DecodeString(salt)
	if err != nil || len(raw) == 0 {
		return nil, fmt.Errorf("%w: salt", ErrMalformedCiphertext)
	}
	return portable(passphrase, raw)
}

func portable(passphrase string, salt []byte) (*PortableSealer, error) {
	if passphrase == "" {
		return nil, ErrEmptyPassphrase
	}
	key := argon2.IDKey([]byte(passphrase), salt, portableTime, portableMemory, portableThreads, KeySize)
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	return &PortableSealer{gcm: gcm, salt: base64.StdEncoding.EncodeToString(salt)}, nil
}

// Salt returns the base64 salt to store alongside the sealed secrets.
func (p *PortableSealer) Salt() string { return p.salt }

// Seal encrypts plaintext, returning base64(nonce || ct).
func (p *PortableSealer) Seal(plaintext string) (string, error) {
	ct, err := encrypt(p.gcm, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("encrypt portable: %w", err)
	}
	return base64.StdEncoding.EncodeToString(ct), nil
}

// Open decrypts a Seal result. A wrong passphrase fails AEAD authentication
// with ErrMalformedCiphertext.
func (p *PortableSealer) Open(ciphertext string) (string, error) {
	ct, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrMalformedCiphertext, err)
	}
	pt, err := decrypt(p.gcm, ct)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}
