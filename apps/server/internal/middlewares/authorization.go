// Package middlewares holds cross-cutting request middleware shared by the
// HTTP server: authentication, rate limiting, and the global error handler.
package middlewares

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
