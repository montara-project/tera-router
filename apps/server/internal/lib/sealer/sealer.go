// Package sealer provides envelope encryption for credentials at rest,
// ported from IDRouter's internal/crypto.
//
// Secrets are never stored in plaintext. Each secret is sealed with a freshly
// generated data encryption key (DEK) using AES-256-GCM; the DEK is itself
// sealed with the key-encryption key (KEK). Only the wrapped DEK and
// ciphertext are persisted. The KEK is derived from APP_SECRET via
// HKDF-SHA256, so a leaked database is useless without the application
// secret.
//
// Every sealed value is bound to the column it is stored in (its purpose) as
// AES-GCM additional data, so a ciphertext copied into another column — a
// provider credential moved into a revealable API key row — fails to open.
package sealer

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// KeySize is the required key length in bytes (AES-256).
const KeySize = 32

// hkdfInfo namespaces the KEK derivation for this application.
const hkdfInfo = "tera:sealer:v1"

// Purposes name the column a secret is sealed for, as "<table>.<prefix>" of
// its <prefix>_wrapped_dek/<prefix>_ciphertext pair.
const (
	PurposeAPIKey         = "api_keys.secret"
	PurposeAccountSecret  = "accounts.secret"
	PurposeAccountToken   = "accounts.token"
	PurposeAccountRefresh = "accounts.refresh"
	PurposeUserTOTP       = "users.totp"
)

// ErrInvalidKeySize is returned when a key is not KeySize bytes.
var ErrInvalidKeySize = fmt.Errorf("sealer: key must be %d bytes", KeySize)

// ErrMalformedCiphertext is returned when sealed data cannot be parsed.
var ErrMalformedCiphertext = errors.New("sealer: malformed ciphertext")

// Sealed is the persisted form of an encrypted secret. Both fields are
// base64-encoded so they round-trip through text columns and JSON.
type Sealed struct {
	// WrappedDEK is the data key encrypted under the master key.
	WrappedDEK string `json:"wrapped_dek"`
	// Ciphertext is the secret encrypted under the data key.
	Ciphertext string `json:"ciphertext"`
}

func (s Sealed) Empty() bool { return s.WrappedDEK == "" || s.Ciphertext == "" }

// Sealer seals and opens secrets using a master key held in memory.
type Sealer struct {
	masterGCM cipher.AEAD
}

// New constructs a Sealer from a 32-byte master key.
func New(masterKey []byte) (*Sealer, error) {
	gcm, err := newGCM(masterKey)
	if err != nil {
		return nil, err
	}
	return &Sealer{masterGCM: gcm}, nil
}

// FromSecret derives the master key from an application secret via
// HKDF-SHA256 and constructs a Sealer.
func FromSecret(appSecret string) (*Sealer, error) {
	if appSecret == "" {
		return nil, errors.New("sealer: empty application secret")
	}
	kek, err := hkdf.Key(sha256.New, []byte(appSecret), nil, hkdfInfo, KeySize)
	if err != nil {
		return nil, fmt.Errorf("sealer: derive kek: %w", err)
	}
	return New(kek)
}

// Seal encrypts plaintext for purpose, returning its persisted Sealed form.
func (s *Sealer) Seal(plaintext []byte, purpose string) (Sealed, error) {
	aad := []byte(purpose)
	// Fresh DEK per secret.
	dek := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return Sealed{}, fmt.Errorf("generate dek: %w", err)
	}

	dataGCM, err := newGCM(dek)
	if err != nil {
		return Sealed{}, err
	}

	ct, err := encrypt(dataGCM, plaintext, aad)
	if err != nil {
		return Sealed{}, fmt.Errorf("encrypt secret: %w", err)
	}
	wrapped, err := encrypt(s.masterGCM, dek, aad)
	if err != nil {
		return Sealed{}, fmt.Errorf("wrap dek: %w", err)
	}

	return Sealed{
		WrappedDEK: base64.StdEncoding.EncodeToString(wrapped),
		Ciphertext: base64.StdEncoding.EncodeToString(ct),
	}, nil
}

// Open decrypts a Sealed secret back into plaintext. It fails unless the
// secret was sealed for the same purpose.
func (s *Sealer) Open(sealed Sealed, purpose string) ([]byte, error) {
	return s.open(sealed, []byte(purpose))
}

// Reseal binds a secret sealed before purposes existed (no additional data) to
// purpose. changed is false when it already opens for purpose. Only the boot
// and import upgrade passes call it: Open itself never accepts an unbound
// secret, or binding would protect nothing.
func (s *Sealer) Reseal(sealed Sealed, purpose string) (out Sealed, changed bool, err error) {
	if _, err := s.Open(sealed, purpose); err == nil {
		return sealed, false, nil
	}
	plain, err := s.open(sealed, nil)
	if err != nil {
		return Sealed{}, false, err
	}
	out, err = s.Seal(plain, purpose)
	return out, err == nil, err
}

func (s *Sealer) open(sealed Sealed, aad []byte) ([]byte, error) {
	wrapped, err := base64.StdEncoding.DecodeString(sealed.WrappedDEK)
	if err != nil {
		return nil, fmt.Errorf("%w: wrapped dek: %v", ErrMalformedCiphertext, err)
	}
	ct, err := base64.StdEncoding.DecodeString(sealed.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("%w: ciphertext: %v", ErrMalformedCiphertext, err)
	}

	dek, err := decrypt(s.masterGCM, wrapped, aad)
	if err != nil {
		return nil, fmt.Errorf("unwrap dek: %w", err)
	}
	dataGCM, err := newGCM(dek)
	if err != nil {
		return nil, err
	}
	return decrypt(dataGCM, ct, aad)
}

// SealString is a convenience wrapper around Seal for string secrets.
func (s *Sealer) SealString(plaintext, purpose string) (Sealed, error) {
	return s.Seal([]byte(plaintext), purpose)
}

// OpenString is a convenience wrapper around Open returning a string.
func (s *Sealer) OpenString(sealed Sealed, purpose string) (string, error) {
	b, err := s.Open(sealed, purpose)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// newGCM builds an AES-256-GCM AEAD from a 32-byte key.
func newGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != KeySize {
		return nil, ErrInvalidKeySize
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// encrypt prepends a random nonce to the GCM ciphertext: nonce || ct.
func encrypt(gcm cipher.AEAD, plaintext, aad []byte) ([]byte, error) {
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, aad), nil
}

// decrypt parses nonce || ct and authenticates+decrypts it.
func decrypt(gcm cipher.AEAD, data, aad []byte) ([]byte, error) {
	ns := gcm.NonceSize()
	if len(data) < ns {
		return nil, ErrMalformedCiphertext
	}
	nonce, ct := data[:ns], data[ns:]
	pt, err := gcm.Open(nil, nonce, ct, aad)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformedCiphertext, err)
	}
	return pt, nil
}
