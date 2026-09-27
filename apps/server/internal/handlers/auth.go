package handlers

import (
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type authHandler struct {
	app *app.Application
}

type signInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (d *signInRequest) Validate(v *validator.MapValidator) {
	v.Field("email").Required().Email()
	v.Field("password").Required().String()
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (d *refreshRequest) Validate(v *validator.MapValidator) {
	v.Field("refresh_token").Required().String()
}

// SignIn verifies credentials and returns the token pair the web client
// stores in cookies. Shaped after the web UI SignInResponse.
func (h *authHandler) SignIn(c fiber.Ctx) error {
	var req signInRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	session, err := h.app.Services.Auth.SignIn(c.Context(), req.Email, req.Password)
	if err != nil {
		return err
	}

	h.app.Services.Console.Push(services.LogLevelInfo, "sign-in · "+session.User.Email, "")
	h.app.Services.Audit.Record(c.Context(), session.User.ID, "auth.sign_in", session.User.ID, nil)
	return dtos.OK(c, sessionView(session))
}

// Refresh rotates the presented refresh token for a new pair.
func (h *authHandler) Refresh(c fiber.Ctx) error {
	var req refreshRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	session, err := h.app.Services.Auth.Refresh(c.Context(), req.RefreshToken)
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

	user, err := h.app.Services.Auth.Me(c.Context(), uid.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, user)
}

// SignOut revokes the user's live refresh tokens.
func (h *authHandler) SignOut(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}

	if err := h.app.Services.Auth.SignOut(c.Context(), uid.String()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "Signed out")
}

// GoogleRedirect is a placeholder for the Google OAuth dashboard login flow.
func (h *authHandler) GoogleRedirect(c fiber.Ctx) error {
	return dtos.Message(c, fiber.StatusNotImplemented, "Google sign-in is not configured yet")
}

// sessionView renders the token response contract of the web UI.
func sessionView(s services.Session) fiber.Map {
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
