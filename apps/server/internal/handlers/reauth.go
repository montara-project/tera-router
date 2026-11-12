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

// reauthenticate re-checks the signed-in user's password, and TOTP code when
// enabled, before an action that exposes secrets (key reveal, backups), so a
// stolen session alone is not enough. totpRequired means the password passed
// and the client must resend with the code. Failures count toward the
// client's IP block, the same brute-force limit failed sign-ins hit.
//
// An empty password instead passes only with a one-use ticket minted by a
// fresh provider ceremony (/oidc/reauth) for this account — a provisioned
// account carries no usable password, so re-authenticating at the identity
// provider is its reauthentication. The bearer session itself never counts
// as the fresh proof: the ticket is a separate credential the ceremony
// hands to the browser. The TOTP factor still applies. Password-bearing
// accounts are untouched: no password and no ticket, no pass.
func reauthenticate(c fiber.Ctx, a *app.Application, password, otp, ticket string) (totpRequired bool, err error) {
	auth := &authHandler{app: a}
	user, err := auth.currentUser(c)
	if err != nil {
		return false, err
	}
	var verr error
	if password == "" {
		verr = auth.verifySSOTicket(c, user, ticket, otp)
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

// verifySSOTicket re-authenticates an OIDC-linked account through a ticket
// the reauth callback minted for it. The ticket is peeked, not consumed, so
// a wrong TOTP code does not burn the ceremony the user just completed; it
// is spent exactly once the second factor passes, and the take still
// refuses a sibling request that raced it.
func (h *authHandler) verifySSOTicket(c fiber.Ctx, user models.User, ticket, otp string) error {
	if user.OIDCSub == "" || ticket == "" {
		return ErrBadCredentials
	}
	uid, ok := oidcReauths.peek(ticket)
	if !ok || uid != user.ID {
		return ErrBadCredentials
	}
	if err := h.verifyTOTP(c.Context(), user, otp); err != nil {
		return err
	}
	if _, ok := oidcReauths.take(ticket); !ok {
		return ErrBadCredentials
	}
	return nil
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
