// Package totp implements RFC 6238 time-based one-time passwords with the
// parameters every authenticator app (Google Authenticator, Authy, 1Password)
// defaults to: HMAC-SHA1, 6 digits, 30-second steps.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	period = 30
	digits = 6
	// skew accepts the previous and next step to absorb phone clock drift.
	skew = 1
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewSecret returns a random 160-bit secret, base32-encoded for the
// authenticator app.
func NewSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return b32.EncodeToString(buf), nil
}

// ValidSecret reports whether secret decodes to at least 128 bits.
func ValidSecret(secret string) bool {
	key, err := b32.DecodeString(strings.ToUpper(secret))
	return err == nil && len(key) >= 16
}

// URL is the otpauth:// URI an authenticator app reads from a QR code.
func URL(issuer, account, secret string) string {
	label := url.PathEscape(issuer + ":" + account)
	q := url.Values{"secret": {secret}, "issuer": {issuer}}
	return "otpauth://totp/" + label + "?" + q.Encode()
}

// Verify checks code against secret at now and returns the matched step.
// Callers persist the step and reject any later code whose step is not newer,
// which stops a captured code from being replayed inside its window.
func Verify(secret, code string, now time.Time) (int64, bool) {
	key, err := b32.DecodeString(strings.ToUpper(secret))
	if err != nil || len(code) != digits {
		return 0, false
	}
	current := now.Unix() / period
	for step := current - skew; step <= current+skew; step++ {
		if subtle.ConstantTimeCompare([]byte(generate(key, step)), []byte(code)) == 1 {
			return step, true
		}
	}
	return 0, false
}

// Code returns the code an authenticator app shows for secret at t.
func Code(secret string, t time.Time) string {
	key, _ := b32.DecodeString(strings.ToUpper(secret))
	return generate(key, t.Unix()/period)
}

func generate(key []byte, step int64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(step))
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	bin := binary.BigEndian.Uint32(sum[off:off+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", digits, bin%1_000_000)
}
