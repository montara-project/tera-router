package handlers

import (
	"errors"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// Re-authentication failures are 422, not 401: the web client treats any 401
// as an expired session and signs the user out.
var (
	errReauthBadPassword = apperr.New(apperr.KindUnprocessable, "invalid password")
	errReauthBadTOTP     = apperr.New(apperr.KindUnprocessable, "invalid authentication code")
)

// ssoReauthWindow bounds how long a session the identity provider opened
// counts as reauthentication: an account that holds no usable password proves
// itself by signing in fresh at the provider. The window matches the SSO
// round-trip TTL and is short enough that a stolen session gains little.
const ssoReauthWindow = 10 * time.Minute

// reauthenticate re-checks the signed-in user's password, and TOTP code when
// enabled, before an action that exposes secrets (key reveal, backups), so a
// stolen session alone is not enough. totpRequired means the password passed
// and the client must resend with the code. Failures count toward the
// client's IP block, the same brute-force limit failed sign-ins hit.
//
// An empty password instead passes when this request's session was opened
// moments ago by an SSO sign-in on an OIDC-linked account — a provisioned
// account carries no usable password, so the fresh IdP authentication is its
// reauthentication. The TOTP factor still applies. Password-bearing accounts
// are untouched: no password, no pass.
func reauthenticate(c fiber.Ctx, a *app.Application, password, otp string) (totpRequired bool, err error) {
	auth := &authHandler{app: a}
	user, err := auth.currentUser(c)
	if err != nil {
		return false, err
	}
	var verr error
	if password == "" && auth.ssoReauthOK(c, user) {
		verr = auth.verifyTOTP(c.Context(), user, otp)
	} else {
		verr = auth.verifyFactors(c.Context(), user, password, otp)
	}
	switch {
	case errors.Is(verr, errTOTPRequired):
		return true, nil
	case errors.Is(verr, ErrBadCredentials):
		failReauth(c, a)
		return false, errReauthBadPassword
	case errors.Is(verr, ErrBadTOTP):
		failReauth(c, a)
		return false, errReauthBadTOTP
	default:
		return false, verr
	}
}

// ssoReauthOK reports whether the request's own session was opened by a
// fresh-enough SSO sign-in on an account bound to an identity provider.
func (h *authHandler) ssoReauthOK(c fiber.Ctx, user models.User) bool {
	if user.OIDCSub == "" {
		return false
	}
	sid := lib.ContextSID(c)
	if sid == "" {
		return false
	}
	rt, err := h.app.Repos.Refresh.Get(c.Context(), sid)
	if err != nil {
		return false
	}
	if rt.AuthMethod != "sso" && rt.AuthMethod != "passkey" {
		return false
	}
	return time.Since(rt.CreatedAt) <= ssoReauthWindow
}

// totpRequired answers a re-authenticated request whose password passed but
// which still needs the authenticator code.
func totpRequired(c fiber.Ctx) error {
	return dtos.OK(c, fiber.Map{"totp_required": true})
}

func failReauth(c fiber.Ctx, a *app.Application) {
	if ip := lib.ContextClientIP(c); ip.IsValid() && a.IPBlocks != nil {
		_ = a.IPBlocks.Fail(c.Context(), ip, time.Now())
	}
}
