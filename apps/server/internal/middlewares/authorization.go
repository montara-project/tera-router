// Package middlewares holds cross-cutting request middleware shared by the
// HTTP server: authentication, rate limiting, and the global error handler.
package middlewares

import (
	"errors"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/token"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// RequireAuth validates the Bearer JWT, stores the user id in request
// locals, and rejects the request otherwise.
//
// A valid signature is not enough: the account must still be usable and the
// token must be newer than its sessions_revoked_at, so sign-out and an
// env-driven password/email change end live sessions at once instead of when
// the access token expires. That is one indexed read per dashboard request;
// the inference gateway authenticates with API keys and never runs this.
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

		usable, revokedAt, err := a.Repos.Users.AuthState(c.Context(), uid.String())
		if errors.Is(err, apperr.ErrNotFound) {
			return apperr.ErrUnauthorized
		}
		if err != nil {
			return err
		}
		if !usable || issuedBefore(claims, revokedAt) {
			return apperr.ErrUnauthorized
		}

		lib.ContextSetUID(c, uid)
		return c.Next()
	}
}

// issuedBefore reports whether the token predates the revocation. Both sides
// carry milliseconds (see lib/token), so signing in again right after signing
// out works while a token issued a moment before the sign-out does not.
//
// iat travels as a float and jwt truncates it back to milliseconds, so it can
// read up to 1ms early; that much slack keeps a token issued in the same
// millisecond as the revocation valid.
func issuedBefore(claims *token.Claims, revokedAt *time.Time) bool {
	if revokedAt == nil {
		return false
	}
	return claims.IssuedAt == nil || claims.IssuedAt.Add(time.Millisecond).Before(*revokedAt)
}
