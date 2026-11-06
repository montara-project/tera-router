package handlers

import (
	"context"
	"errors"
	"sync"
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

// dummyHash is verified against for unknown emails; see signIn.
var dummyHash = sync.OnceValue(func() string {
	h, _ := password.Hash("tera-router-dummy-password")
	return h
})

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

	session, err := h.signIn(c.Context(), req.Email, req.Password, req.OTP, clientOf(c))
	if errors.Is(err, errTOTPRequired) {
		// Password checked out; the client asks for the code and resubmits.
		return dtos.OK(c, fiber.Map{"totp_required": true})
	}
	if err != nil {
		// A refused sign-in is recorded too; its status marks it failed.
		auditRecord(c, "", "auth.sign_in", req.Email, nil)
		return err
	}

	consoleInfof("sign-in · %s", session.User.Email)
	lib.ContextSetSID(c, session.SessionID)
	auditRecord(c, session.User.ID, "auth.sign_in", session.User.ID, nil)
	return dtos.OK(c, sessionView(session))
}

// signIn verifies the credentials, and the TOTP code when the user enabled
// it, then opens a new session from cl.
func (h *authHandler) signIn(ctx context.Context, email, plainPassword, otp string, cl client) (dtos.Session, error) {
	user, err := h.app.Repos.Users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			// Spend the same argon2 work as a real account, so response time
			// does not reveal which emails are registered.
			_, _ = password.Verify(plainPassword, dummyHash())
			return dtos.Session{}, ErrBadCredentials
		}
		return dtos.Session{}, err
	}

	if err := h.verifyFactors(ctx, user, plainPassword, otp); err != nil {
		return dtos.Session{}, err
	}
	return h.openSession(ctx, user, cl)
}

// verifyFactors checks the password, and the TOTP code when the user enabled
// it. errTOTPRequired means the password passed but no code was sent.
func (h *authHandler) verifyFactors(ctx context.Context, user models.User, plainPassword, otp string) error {
	ok, err := password.Verify(plainPassword, user.PasswordHash)
	if err != nil || !ok || !user.IsActive || user.IsBlocked {
		return ErrBadCredentials
	}
	if !user.TOTPEnabled {
		return nil
	}
	if otp == "" {
		return errTOTPRequired
	}
	return h.checkTOTP(ctx, user, otp)
}

// Refresh rotates the presented refresh token: its session gets a new token
// in place (same session id) and a new pair is issued for its owner.
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

	refreshRaw, refreshHash, err := token.NewRefresh()
	if err != nil {
		return err
	}
	err = h.app.Repos.Refresh.Rotate(ctx, stored.ID, stored.TokenHash, refreshHash, time.Now().Add(refreshTTL))
	if errors.Is(err, apperr.ErrNotFound) {
		return apperr.ErrUnauthorized
	}
	if err != nil {
		return err
	}

	session, err := h.sessionFor(user, stored.ID, refreshRaw)
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

// SignOut ends every session of the user: all refresh tokens are revoked and
// access tokens issued before now are refused by RequireAuth. The web client
// keeps the refresh token in a cookie the server cannot read, so revoking all
// of the user's tokens is the safe interpretation.
func (h *authHandler) SignOut(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	if err := h.app.Repos.Refresh.RevokeAllForUser(c.Context(), uid.String()); err != nil {
		return err
	}
	if err := h.app.Repos.Users.RevokeSessions(c.Context(), uid.String()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "Signed out")
}

// sessionItem is one row of GET /v1/auth/sessions.
type sessionItem struct {
	models.RefreshToken
	Current bool `json:"current"`
}

// Sessions lists the signed-in user's active sessions; the one making the
// request is marked current.
func (h *authHandler) Sessions(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	rows, err := h.app.Repos.Refresh.ListActive(c.Context(), uid.String())
	if err != nil {
		return err
	}
	sid := lib.ContextSID(c)
	items := make([]sessionItem, len(rows))
	for i, r := range rows {
		items[i] = sessionItem{RefreshToken: r, Current: r.ID == sid}
	}
	return dtos.OK(c, items)
}

// RevokeSession ends one of the user's sessions (DELETE
// /v1/auth/sessions/:id): its refresh token stops working and RequireAuth
// refuses its access tokens at once.
func (h *authHandler) RevokeSession(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	if err := h.app.Repos.Refresh.RevokeForUser(c.Context(), id, uid.String()); err != nil {
		return err
	}
	auditRecord(c, uid.String(), "auth.session_revoke", id, nil)
	return dtos.Message(c, fiber.StatusOK, "Session revoked")
}

// GoogleRedirect is a placeholder for the Google OAuth dashboard login flow.
func (h *authHandler) GoogleRedirect(c fiber.Ctx) error {
	return dtos.Message(c, fiber.StatusNotImplemented, "Google sign-in is not configured yet")
}

// client is where a sign-in came from, kept on its session for the list.
type client struct {
	userAgent string
	ip        string
}

func clientOf(c fiber.Ctx) client {
	ip := c.IP()
	if addr := lib.ContextClientIP(c); addr.IsValid() {
		ip = addr.String()
	}
	return client{userAgent: c.Get(fiber.HeaderUserAgent), ip: ip}
}

// openSession stores a new session for user and signs its first token pair.
func (h *authHandler) openSession(ctx context.Context, user models.User, cl client) (dtos.Session, error) {
	refreshRaw, refreshHash, err := token.NewRefresh()
	if err != nil {
		return dtos.Session{}, err
	}
	rt := models.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		UserAgent: cl.userAgent,
		IPAddress: cl.ip,
		ExpiresAt: time.Now().Add(refreshTTL),
	}
	if err := h.app.Repos.Refresh.Insert(ctx, rt); err != nil {
		return dtos.Session{}, err
	}
	return h.sessionFor(user, rt.ID, refreshRaw)
}

// sessionFor signs an access token for session sid and pairs it with the
// session's raw refresh token.
func (h *authHandler) sessionFor(user models.User, sid, refreshRaw string) (dtos.Session, error) {
	access, expiresAt, err := token.SignAccess(h.app.Config.App.Secret, user.ID, sid, user.Email, user.Role.Name, time.Now(), accessTTL)
	if err != nil {
		return dtos.Session{}, err
	}

	return dtos.Session{
		User:      user,
		SessionID: sid,
		Tokens: dtos.TokenPair{
			AccessToken:  access,
			RefreshToken: refreshRaw,
			IDToken:      access,
			ExpiresAt:    expiresAt,
			ExpiresIn:    int(accessTTL.Seconds()),
		},
	}, nil
}

// sessionView renders the token response contract of the web UI.
func sessionView(s dtos.Session) fiber.Map {
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
