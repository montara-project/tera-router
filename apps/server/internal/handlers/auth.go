package handlers

import (
	"context"
	"errors"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/password"
	"tera-router/server/internal/lib/token"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
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

type authHandler struct {
	app *app.Application
}

// SignIn verifies credentials and returns the token pair the web client
// stores in cookies. Shaped after the web UI SignInResponse.
func (h *authHandler) SignIn(c fiber.Ctx) error {
	var req dtos.SignIn
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	session, err := h.signIn(c.Context(), req.Email, req.Password)
	if err != nil {
		return err
	}

	consoleInfof("sign-in · %s", session.User.Email)
	auditRecord(c.Context(), h.app, session.User.ID, "auth.sign_in", session.User.ID, nil)
	return dtos.OK(c, sessionView(session))
}

// signIn verifies the credentials and issues a new token pair.
func (h *authHandler) signIn(ctx context.Context, email, plainPassword string) (Session, error) {
	user, err := h.app.Repos.Users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return Session{}, ErrBadCredentials
		}
		return Session{}, err
	}
	if !user.IsActive || user.IsBlocked {
		return Session{}, ErrBadCredentials
	}

	ok, err := password.Verify(plainPassword, user.PasswordHash)
	if err != nil || !ok {
		return Session{}, ErrBadCredentials
	}

	return h.issueSession(ctx, user)
}

// Refresh rotates the presented refresh token: the presented token is
// revoked and a new pair is issued for its owner.
func (h *authHandler) Refresh(c fiber.Ctx) error {
	var req dtos.Refresh
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	ctx := c.Context()
	stored, err := h.app.Repos.Refresh.GetValid(ctx, token.Hash(req.RefreshToken))
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return apperr.ErrUnauthorized
		}
		return err
	}

	user, err := h.app.Repos.Users.Get(ctx, stored.UserID)
	if err != nil {
		return err
	}
	if !user.IsActive || user.IsBlocked {
		return apperr.ErrUnauthorized
	}

	if err := h.app.Repos.Refresh.Revoke(ctx, stored.ID); err != nil {
		return err
	}

	session, err := h.issueSession(ctx, user)
	if err != nil {
		return err
	}
	return dtos.OK(c, sessionView(session))
}

// Me returns the signed-in user's profile.
func (h *authHandler) Me(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	user, err := h.app.Repos.Users.Get(c.Context(), uid.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, user)
}

// SignOut revokes every live refresh token of the user. The web client keeps
// the refresh token in a cookie the server cannot read, so revoking all of
// the user's tokens is the safe interpretation.
func (h *authHandler) SignOut(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	if err := h.app.Repos.Refresh.RevokeAllForUser(c.Context(), uid.String()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "Signed out")
}

// GoogleRedirect is a placeholder for the Google OAuth dashboard login flow.
func (h *authHandler) GoogleRedirect(c fiber.Ctx) error {
	return dtos.Message(c, fiber.StatusNotImplemented, "Google sign-in is not configured yet")
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

func (h *authHandler) issueSession(ctx context.Context, user models.User) (Session, error) {
	now := time.Now()

	access, expiresAt, err := token.SignAccess(h.app.Config.App.Secret, user.ID, user.Email, user.Role.Name, now, accessTTL)
	if err != nil {
		return Session{}, err
	}

	refreshRaw, refreshHash, err := token.NewRefresh()
	if err != nil {
		return Session{}, err
	}
	rt := models.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: now.Add(refreshTTL),
	}
	if err := h.app.Repos.Refresh.Insert(ctx, rt); err != nil {
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

// sessionView renders the token response contract of the web UI.
func sessionView(s Session) fiber.Map {
	return fiber.Map{
		"uid":           s.User.ID,
		"display_name":  displayName(s.User),
		"email":         s.User.Email,
		"access_token":  s.Tokens.AccessToken,
		"refresh_token": s.Tokens.RefreshToken,
		"id_token":      s.Tokens.IDToken,
		"expires_at":    s.Tokens.ExpiresAt.Format(time.RFC3339),
		"expires_in":    s.Tokens.ExpiresIn,
		"role":          s.User.Role.Name,
	}
}

func displayName(u models.User) string {
	if u.Fullname != "" {
		return u.Fullname
	}
	return u.Email
}
