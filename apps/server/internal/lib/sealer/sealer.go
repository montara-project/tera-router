// Package sealer provides envelope encryption for credentials at rest,
// ported from IDRouter's internal/crypto.
//
// Secrets are never stored in plaintext. Each secret is sealed with a freshly
// generated data encryption key (DEK) using AES-256-GCM; the DEK is itself
// sealed with the key-encryption key (KEK). Only the wrapped DEK and
// ciphertext are persisted. The KEK is derived from APP_SECRET via
// HKDF-SHA256, so a leaked database is useless without the application
// secret.
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
const hkdfInfo = "tera-router:sealer:v1"

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

// Seal encrypts plaintext, returning its persisted Sealed form.
func (s *Sealer) Seal(plaintext []byte) (Sealed, error) {
	// Fresh DEK per secret.
	dek := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return Sealed{}, fmt.Errorf("generate dek: %w", err)
	}

	dataGCM, err := newGCM(dek)
	if err != nil {
		return Sealed{}, err
	}

	ct, err := encrypt(dataGCM, plaintext)
	if err != nil {
		return Sealed{}, fmt.Errorf("encrypt secret: %w", err)
	}
	wrapped, err := encrypt(s.masterGCM, dek)
	if err != nil {
		return Sealed{}, fmt.Errorf("wrap dek: %w", err)
	}

	return Sealed{
		WrappedDEK: base64.StdEncoding.EncodeToString(wrapped),
		Ciphertext: base64.StdEncoding.EncodeToString(ct),
	}, nil
}

// Open decrypts a Sealed secret back into plaintext.
func (s *Sealer) Open(sealed Sealed) ([]byte, error) {
	wrapped, err := base64.StdEncoding.DecodeString(sealed.WrappedDEK)
	if err != nil {
		return nil, fmt.Errorf("%w: wrapped dek: %v", ErrMalformedCiphertext, err)
	}
	ct, err := base64.StdEncoding.DecodeString(sealed.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("%w: ciphertext: %v", ErrMalformedCiphertext, err)
	}

	dek, err := decrypt(s.masterGCM, wrapped)
	if err != nil {
		return nil, fmt.Errorf("unwrap dek: %w", err)
	}
	dataGCM, err := newGCM(dek)
	if err != nil {
		return nil, err
	}
	return decrypt(dataGCM, ct)
}

// SealString is a convenience wrapper around Seal for string secrets.
func (s *Sealer) SealString(plaintext string) (Sealed, error) {
	return s.Seal([]byte(plaintext))
}

// OpenString is a convenience wrapper around Open returning a string.
func (s *Sealer) OpenString(sealed Sealed) (string, error) {
	b, err := s.Open(sealed)
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
func encrypt(gcm cipher.AEAD, plaintext []byte) ([]byte, error) {
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// decrypt parses nonce || ct and authenticates+decrypts it.
func decrypt(gcm cipher.AEAD, data []byte) ([]byte, error) {
	ns := gcm.NonceSize()
	if len(data) < ns {
		return nil, ErrMalformedCiphertext
	}
	nonce, ct := data[:ns], data[ns:]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformedCiphertext, err)
	}
	return pt, nil
}
