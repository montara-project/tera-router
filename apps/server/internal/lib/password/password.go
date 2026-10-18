// Package password hashes and verifies passwords with argon2id, ported from
// IDRouter's internal/crypto. Hashes use the PHC string format so parameters
// are embedded and can evolve without breaking stored hashes.
package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/argon2"
)

// argon2 parameters tuned for interactive verification on commodity hardware.
const (
	argonTime    = 1
	argonMemory  = 64 * 1024 // 64 MiB
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16
)

// maxConcurrent caps argon2 runs in flight. Each one holds argonMemory, so an
// unbounded burst of sign-ins (the endpoint is public) could exhaust memory;
// extra callers queue instead.
// ponytail: callers wait without a deadline; add a timeout returning 429 if
// queued sign-ins ever need to give up under sustained attack.
const maxConcurrent = 4

var slots = make(chan struct{}, maxConcurrent)

// idKey is argon2.IDKey behind the concurrency cap.
func idKey(password, salt []byte, time, memory uint32, threads uint8, keyLen uint32) []byte {
	slots <- struct{}{}
	defer func() { <-slots }()
	return argon2.IDKey(password, salt, time, memory, threads, keyLen)
}

// ErrInvalidHash is returned when a stored hash cannot be parsed.
var ErrInvalidHash = errors.New("password: invalid argon2 hash")

// Hash produces an argon2id PHC-style hash of the plaintext.
func Hash(plaintext string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	digest := idKey([]byte(plaintext), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

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
	got := idKey([]byte(plaintext), salt, time, mem, threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
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
