package handlers

import (
	"errors"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

// Re-authentication failures are 422, not 401: the web client treats any 401
// as an expired session and signs the user out.
var (
	errReauthBadPassword = apperr.New(apperr.KindUnprocessable, "invalid password")
	errReauthBadTOTP     = apperr.New(apperr.KindUnprocessable, "invalid authentication code")
)

// reauthenticate re-checks the signed-in user's password, and TOTP code when
// enabled, before an action that exposes secrets (key reveal, backups), so a
// stolen session alone is not enough. totpRequired means the password passed
// and the client must resend with the code. Failures count toward the
// client's IP block, the same brute-force limit failed sign-ins hit.
func reauthenticate(c fiber.Ctx, a *app.Application, password, otp string) (totpRequired bool, err error) {
	auth := &authHandler{app: a}
	user, err := auth.currentUser(c)
	if err != nil {
		return false, err
	}
	switch err := auth.verifyFactors(c.Context(), user, password, otp); {
	case errors.Is(err, errTOTPRequired):
		return true, nil
	case errors.Is(err, ErrBadCredentials):
		failReauth(c, a)
		return false, errReauthBadPassword
	case errors.Is(err, ErrBadTOTP):
		failReauth(c, a)
		return false, errReauthBadTOTP
	default:
		return false, err
	}
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
