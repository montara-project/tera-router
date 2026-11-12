package token

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-0123456789abcdef"

func mustSign(t *testing.T, method jwt.SigningMethod, claims jwt.Claims, key any) string {
	t.Helper()
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatalf("sign %s: %v", method.Alg(), err)
	}
	return s
}

// TestSignThenParseAccess round-trips the token SignAccess mints: the claims
// the auth middleware relies on (sub, jti as the session id, email, role,
// iss) must survive.
func TestSignThenParseAccess(t *testing.T) {
	now := time.Now()
	signed, expiresAt, err := SignAccess(testSecret, "user-1", "sess-9", "u@x.dev", "admin", now, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if !expiresAt.Equal(now.Add(time.Hour)) {
		t.Fatalf("expiresAt = %v, want %v", expiresAt, now.Add(time.Hour))
	}

	claims, err := ParseAccess(testSecret, signed)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.Subject != "user-1" || claims.ID != "sess-9" {
		t.Errorf("sub/jti = %q/%q, want user-1/sess-9", claims.Subject, claims.ID)
	}
	if claims.Email != "u@x.dev" || claims.Role != "admin" {
		t.Errorf("email/role = %q/%q", claims.Email, claims.Role)
	}
	if claims.Issuer != "tera-router" {
		t.Errorf("iss = %q, want tera-router", claims.Issuer)
	}
	// Timestamps carry milliseconds (jwt.TimePrecision), but the wire form is
	// a float64 seconds value whose sub-second part is not exactly
	// representable, so a round-trip can land 1ms under the truncated time.
	withinMS := func(got, want time.Time) bool {
		d := got.Sub(want)
		return d >= -time.Millisecond && d <= time.Millisecond
	}
	if claims.ExpiresAt == nil || !withinMS(claims.ExpiresAt.Time, expiresAt.Truncate(time.Millisecond)) {
		t.Errorf("exp = %v, want within 1ms of %v", claims.ExpiresAt, expiresAt.Truncate(time.Millisecond))
	}
	if claims.IssuedAt == nil || !withinMS(claims.IssuedAt.Time, now.Truncate(time.Millisecond)) {
		t.Errorf("iat = %v, want within 1ms of %v", claims.IssuedAt, now.Truncate(time.Millisecond))
	}
}

// TestParseAccessRejected covers the validation boundary: the keyfunc only
// accepts HMAC methods (an alg=none or asymmetric-alg token must never pass
// the HMAC secret check), and the parser enforces exp and nbf. It does NOT
// verify iss/aud — SignAccess sets iss for information only, so a wrong
// issuer is not a rejection case here.
func TestParseAccessRejected(t *testing.T) {
	now := time.Now()
	valid, _, err := SignAccess(testSecret, "user-1", "sess-9", "u@x.dev", "admin", now, time.Hour)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	freshClaims := func() Claims {
		return Claims{
			Email: "u@x.dev", Role: "admin",
			RegisteredClaims: jwt.RegisteredClaims{
				Subject: "user-1", ID: "sess-9", Issuer: "tera-router",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		}
	}

	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa key: %v", err)
	}
	ecKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("ec key: %v", err)
	}

	// Tamper the signature: flip the FIRST base64url character of the
	// signature segment. The last character is unusable for this — a 32-byte
	// signature encodes to 43 chars, so its low 2 bits are padding and
	// changing them alone leaves the decoded bytes identical.
	tampered := func() string {
		i := strings.LastIndexByte(valid, '.')
		repl := byte('A')
		if valid[i+1] == 'A' {
			repl = 'B'
		}
		return valid[:i+1] + string(repl) + valid[i+2:]
	}()

	expired, _, err := SignAccess(testSecret, "user-1", "sess-9", "u@x.dev", "admin", now.Add(-2*time.Hour), time.Hour)
	if err != nil {
		t.Fatalf("sign expired: %v", err)
	}
	notYetClaims := freshClaims()
	notYetClaims.NotBefore = jwt.NewNumericDate(now.Add(time.Hour))

	cases := []struct {
		name  string
		token string
	}{
		{"expired", expired},
		{"not yet valid (nbf)", mustSign(t, jwt.SigningMethodHS256, notYetClaims, []byte(testSecret))},
		{"alg none", mustSign(t, jwt.SigningMethodNone, freshClaims(), jwt.UnsafeAllowNoneSignatureType)},
		{"RS256 signed", mustSign(t, jwt.SigningMethodRS256, freshClaims(), rsaKey)},
		{"ES256 signed", mustSign(t, jwt.SigningMethodES256, freshClaims(), ecKey)},
		{"wrong HMAC secret", mustSign(t, jwt.SigningMethodHS256, freshClaims(), []byte("other-secret"))},
		{"tampered signature", tampered},
		{"not a jwt", "not-a-token"},
		{"empty", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			claims, err := ParseAccess(testSecret, tc.token)
			if err == nil {
				t.Fatalf("ParseAccess(%q) accepted, claims = %+v", tc.token, claims)
			}
			// The error stays generic: which check failed must not leak.
			if err.Error() != "invalid token" {
				t.Errorf("error = %q, want generic %q", err.Error(), "invalid token")
			}
		})
	}
}

// TestParseAccessAcceptsHMACVariants documents the actual algorithm check:
// the keyfunc rejects anything that is not *jwt.SigningMethodHMAC, which
// covers HS256, HS384, and HS512 alike — HS512 signed with the right secret
// parses. (Issued tokens are always HS256.)
func TestParseAccessAcceptsHMACVariants(t *testing.T) {
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodHS256, jwt.SigningMethodHS384, jwt.SigningMethodHS512} {
		t.Run(method.Alg(), func(t *testing.T) {
			signed := mustSign(t, method, claims, []byte(testSecret))
			got, err := ParseAccess(testSecret, signed)
			if err != nil {
				t.Fatalf("ParseAccess(%s token): %v", method.Alg(), err)
			}
			if got.Subject != "user-1" {
				t.Errorf("sub = %q, want user-1", got.Subject)
			}
		})
	}
}

// TestNewRefreshAndHash: refresh tokens are random; the stored index is the
// deterministic sha-256 hex of the raw token.
func TestNewRefreshAndHash(t *testing.T) {
	raw1, hash1, err := NewRefresh()
	if err != nil {
		t.Fatalf("new refresh: %v", err)
	}
	raw2, _, err := NewRefresh()
	if err != nil {
		t.Fatalf("new refresh: %v", err)
	}
	if raw1 == "" || raw1 == raw2 {
		t.Errorf("refresh tokens must be non-empty and random, got %q and %q", raw1, raw2)
	}

	want := sha256.Sum256([]byte(raw1))
	if hash1 != hex.EncodeToString(want[:]) {
		t.Errorf("hash = %q, want sha256(%q) = %q", hash1, raw1, hex.EncodeToString(want[:]))
	}
	if Hash(raw1) != hash1 {
		t.Errorf("Hash(%q) = %q, want %q (deterministic)", raw1, Hash(raw1), hash1)
	}
	if _, err := hex.DecodeString(hash1); err != nil || len(hash1) != 64 {
		t.Errorf("hash %q is not 64 hex chars: %v", hash1, err)
	}
	if strings.ContainsAny(raw1, "+/=") {
		t.Errorf("raw token %q must be base64url-safe", raw1)
	}
}
