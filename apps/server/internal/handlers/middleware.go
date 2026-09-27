package handlers

import (
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// RequireAuth validates the Bearer JWT, stores the user id in request
// locals, and rejects the request otherwise.
func RequireAuth(a *app.Application) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || token == "" {
			return apperr.ErrUnauthorized
		}

		claims, err := a.Services.Auth.ParseAccessToken(token)
		if err != nil {
			return err
		}

		uid, err := uuid.Parse(claims.Subject)
		if err != nil {
			return apperr.ErrUnauthorized
		}

		lib.ContextSetUID(c, uid)
		return c.Next()
	}
}

// actor returns the display name for audit entries derived from the JWT
// locals; falls back to the raw subject when the token has no email.
func actorFrom(c fiber.Ctx) string {
	if uid, err := lib.ContextGetUID(c); err == nil {
		return uid.String()
	}
	return "system"
}
