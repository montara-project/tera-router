package handlers

import (
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/token"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// RequireAuth validates the Bearer JWT, stores the user id in request
// locals, and rejects the request otherwise.
func RequireAuth(a *app.Application) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		bearer, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || bearer == "" {
			return apperr.ErrUnauthorized
		}

		claims, err := token.ParseAccess(a.Config.App.Secret, bearer)
		if err != nil {
			return apperr.ErrUnauthorized
		}

		uid, err := uuid.Parse(claims.Subject)
		if err != nil {
			return apperr.ErrUnauthorized
		}

		lib.ContextSetUID(c, uid)
		return c.Next()
	}
}

// actorFrom returns the user id for audit entries derived from the JWT
// locals; falls back to "system".
func actorFrom(c fiber.Ctx) string {
	if uid, err := lib.ContextGetUID(c); err == nil {
		return uid.String()
	}
	return "system"
}
