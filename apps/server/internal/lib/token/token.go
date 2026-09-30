// Package token issues and verifies the dashboard's JWT access tokens and
// opaque refresh tokens (wrapping golang-jwt). Tokens are HMAC-SHA256 signed
// with APP_SECRET; refresh tokens are random and only stored as sha-256.
package token

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims are the access-token claims verified by the auth middleware.
type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// SignAccess mints an HS256 access token, returning the token and expiry.
func SignAccess(secret, subject, email, role string, now time.Time, ttl time.Duration) (string, time.Time, error) {
	expiresAt := now.Add(ttl)
	claims := Claims{
		Email: email,
		Role:  role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			Issuer:    "tera-router",
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}
	return signed, expiresAt, nil
}

// ParseAccess validates a bearer JWT and returns its claims.
func ParseAccess(secret, tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// NewRefresh mints an opaque refresh token, returning the raw value (shown
// once to the client) and its sha-256 index for storage.
func NewRefresh() (raw, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("generate refresh token: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	return raw, Hash(raw), nil
}

// Hash is the deterministic sha-256 index for refresh token lookups. The raw
// token is never stored.
func Hash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
