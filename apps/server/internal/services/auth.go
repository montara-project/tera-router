package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/lib/apperr"
	passwordlib "tera-router/server/internal/lib/password"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	// accessTTL matches the web client's default cookie max-age (1 hour).
	accessTTL = time.Hour
	// refreshTTL matches the web client's 30-day refresh cookie.
	refreshTTL = 30 * 24 * time.Hour
)

// ErrBadCredentials is returned for unknown emails or wrong passwords. It
// deliberately does not distinguish the two cases.
var ErrBadCredentials = apperr.New(apperr.KindUnauthorized, "invalid email or password")

type AuthService struct {
	repos   *repositories.Repositories
	secrets *sealer.Sealer
	cfg     *config.Config
}

// Session is the sign-in result: the user plus freshly issued tokens.
type Session struct {
	User   models.User `json:"-"`
	Tokens TokenPair   `json:"-"`
}

// TokenPair carries the three tokens the web client stores.
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	IDToken      string    `json:"id_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	ExpiresIn    int       `json:"expires_in"`
}

// Claims are the access-token claims verified by the auth middleware.
type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// SignIn verifies the credentials and issues a new token pair.
func (s *AuthService) SignIn(ctx context.Context, email, password string) (Session, error) {
	user, err := s.repos.Users.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return Session{}, ErrBadCredentials
		}
		return Session{}, err
	}
	if !user.IsActive || user.IsBlocked {
		return Session{}, ErrBadCredentials
	}

	ok, err := passwordlib.Verify(password, user.PasswordHash)
	if err != nil || !ok {
		return Session{}, ErrBadCredentials
	}

	return s.issueSession(ctx, user)
}

// Refresh rotates a refresh token: the presented token is revoked and a new
// pair is issued for its owner.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (Session, error) {
	hash := hashToken(refreshToken)
	stored, err := s.repos.Refresh.FindValid(ctx, hash)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return Session{}, apperr.ErrUnauthorized
		}
		return Session{}, err
	}

	user, err := s.repos.Users.FindByID(ctx, stored.UserID)
	if err != nil {
		return Session{}, err
	}
	if !user.IsActive || user.IsBlocked {
		return Session{}, apperr.ErrUnauthorized
	}

	if err := s.repos.Refresh.Revoke(ctx, stored.ID); err != nil {
		return Session{}, err
	}
	return s.issueSession(ctx, user)
}

// Me loads the signed-in user profile.
func (s *AuthService) Me(ctx context.Context, uid string) (models.User, error) {
	return s.repos.Users.FindByID(ctx, uid)
}

// SignOut revokes every live refresh token of the user. The web client keeps
// the refresh token in a cookie the server cannot read, so revoking all of
// the user's tokens is the safe interpretation.
func (s *AuthService) SignOut(ctx context.Context, uid string) error {
	return s.repos.Refresh.RevokeAllForUser(ctx, uid)
}

func (s *AuthService) issueSession(ctx context.Context, user models.User) (Session, error) {
	now := time.Now()
	expiresAt := now.Add(accessTTL)

	access, err := s.signAccessToken(user, now, expiresAt)
	if err != nil {
		return Session{}, err
	}

	refreshRaw, err := newRefreshToken()
	if err != nil {
		return Session{}, err
	}
	rt := models.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: hashToken(refreshRaw),
		ExpiresAt: now.Add(refreshTTL),
	}
	if err := s.repos.Refresh.Create(ctx, rt); err != nil {
		return Session{}, err
	}

	return Session{
		User: user,
		Tokens: TokenPair{
			AccessToken:  access,
			RefreshToken: refreshRaw,
			IDToken:      access,
			ExpiresAt:    expiresAt,
			ExpiresIn:    int(accessTTL.Seconds()),
		},
	}, nil
}

func (s *AuthService) signAccessToken(user models.User, now, expiresAt time.Time) (string, error) {
	claims := Claims{
		Email: user.Email,
		Role:  user.Role.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			Issuer:    "tera-router",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.App.Secret))
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

// ParseAccessToken validates a bearer JWT and returns its claims.
func (s *AuthService) ParseAccessToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.App.Secret), nil
	})
	if err != nil || !token.Valid {
		return nil, apperr.ErrUnauthorized
	}
	return claims, nil
}

func newRefreshToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// hashToken is the deterministic index for refresh token lookups. The raw
// token is never stored.
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
