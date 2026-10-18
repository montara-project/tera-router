package handlers

import (
	"context"
	"time"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/lib/totp"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// totpIssuer is the account label shown in the authenticator app.
const totpIssuer = "Tera Router"

var (
	// errTOTPRequired marks a correct password on an account with TOTP on;
	// SignIn turns it into a totp_required response, not an error.
	errTOTPRequired = apperr.New(apperr.KindUnauthorized, "authentication code required")
	// ErrBadTOTP covers wrong, expired and replayed codes alike.
	ErrBadTOTP = apperr.New(apperr.KindUnauthorized, "invalid authentication code")
)

// checkTOTP verifies code against the user's sealed secret and burns its step.
// ponytail: brute force is bounded only by the password gate and the
// per-IP dashboard rate limit; add a per-user failure lockout if that falls short.
func (h *authHandler) checkTOTP(ctx context.Context, user models.User, code string) error {
	secret, err := h.app.Secrets.OpenString(sealer.Sealed{WrappedDEK: user.TOTPWrappedDEK, Ciphertext: user.TOTPCiphertext})
	if err != nil {
		return err
	}
	step, ok := totp.Verify(secret, code, time.Now())
	if !ok || step <= user.TOTPLastStep {
		return ErrBadTOTP
	}
	fresh, err := h.app.Repos.Users.ConsumeTOTPStep(ctx, user.ID, step)
	if err != nil {
		return err
	}
	if !fresh {
		return ErrBadTOTP
	}
	return nil
}

// currentUser loads the signed-in user.
func (h *authHandler) currentUser(c fiber.Ctx) (models.User, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return models.User{}, err
	}
	return h.app.Repos.Users.Get(c.Context(), uid.String())
}

// TOTPSetup issues a fresh secret for enrollment (POST /v1/auth/totp/setup).
// Nothing is stored until TOTPEnable confirms a code generated from it.
func (h *authHandler) TOTPSetup(c fiber.Ctx) error {
	user, err := h.currentUser(c)
	if err != nil {
		return err
	}
	if user.TOTPEnabled {
		return apperr.New(apperr.KindConflict, "two-factor authentication is already enabled")
	}

	secret, err := totp.NewSecret()
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"secret":      secret,
		"otpauth_url": totp.URL(totpIssuer, user.Email, secret),
	})
}

// TOTPEnable turns TOTP on once the user proves their app generates valid
// codes for the secret (POST /v1/auth/totp/enable).
func (h *authHandler) TOTPEnable(c fiber.Ctx) error {
	var req dtos.TOTPEnable
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	user, err := h.currentUser(c)
	if err != nil {
		return err
	}
	if user.TOTPEnabled {
		return apperr.New(apperr.KindConflict, "two-factor authentication is already enabled")
	}
	if !totp.ValidSecret(req.Secret) {
		return apperr.New(apperr.KindBadRequest, "invalid secret")
	}

	step, ok := totp.Verify(req.Secret, req.Code, time.Now())
	if !ok {
		return ErrBadTOTP
	}
	sealed, err := h.app.Secrets.SealString(req.Secret)
	if err != nil {
		return err
	}
	if err := h.app.Repos.Users.SetTOTP(c.Context(), user.ID, sealed.WrappedDEK, sealed.Ciphertext, step); err != nil {
		return err
	}

	auditRecord(c.Context(), h.app, user.ID, "auth.totp_enable", user.ID, nil)
	return dtos.Message(c, fiber.StatusOK, "Two-factor authentication enabled")
}

// TOTPDisable turns TOTP off after a current code (POST /v1/auth/totp/disable).
func (h *authHandler) TOTPDisable(c fiber.Ctx) error {
	var req dtos.TOTPDisable
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	user, err := h.currentUser(c)
	if err != nil {
		return err
	}
	if !user.TOTPEnabled {
		return apperr.New(apperr.KindConflict, "two-factor authentication is not enabled")
	}
	if err := h.checkTOTP(c.Context(), user, req.Code); err != nil {
		return err
	}
	if err := h.app.Repos.Users.ClearTOTP(c.Context(), user.ID); err != nil {
		return err
	}

	auditRecord(c.Context(), h.app, user.ID, "auth.totp_disable", user.ID, nil)
	return dtos.Message(c, fiber.StatusOK, "Two-factor authentication disabled")
}
