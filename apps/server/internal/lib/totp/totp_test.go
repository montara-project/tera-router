package totp

import (
	"encoding/base32"
	"strings"
	"testing"
	"time"
)

// RFC 6238 appendix B, SHA-1 key "12345678901234567890", truncated to 6 digits.
func TestVerifyRFC6238Vectors(t *testing.T) {
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))
	cases := []struct {
		unix int64
		code string
	}{
		{59, "287082"},
		{1111111109, "081804"},
		{1234567890, "005924"},
		{2000000000, "279037"},
	}
	for _, c := range cases {
		step, ok := Verify(secret, c.code, time.Unix(c.unix, 0))
		if !ok || step != c.unix/period {
			t.Errorf("Verify(%d, %s) = %d, %v", c.unix, c.code, step, ok)
		}
	}
}

func TestVerifyWindow(t *testing.T) {
	secret, err := NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	if !ValidSecret(secret) || !ValidSecret(strings.ToLower(secret)) {
		t.Fatal("generated secret should be valid")
	}
	key, _ := b32.DecodeString(secret)
	now := time.Unix(1_700_000_000, 0)
	step := now.Unix() / period

	if _, ok := Verify(secret, generate(key, step-1), now); !ok {
		t.Error("previous step should be accepted")
	}
	if _, ok := Verify(secret, generate(key, step+2), now); ok {
		t.Error("code two steps ahead should be rejected")
	}
	if _, ok := Verify(secret, "12345", now); ok {
		t.Error("short code should be rejected")
	}
	if ValidSecret("not base32!") {
		t.Error("garbage secret should be invalid")
	}
}
