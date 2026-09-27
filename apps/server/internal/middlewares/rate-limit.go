package middlewares

import (
	"time"

	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

const (
	// rateLimitMax is the number of requests allowed per window per client IP.
	rateLimitMax = 100
	// rateLimitExpiration is the sliding window for the limiter.
	rateLimitExpiration = time.Minute
)

// RateLimit throttles each client IP to rateLimitMax requests per window.
// Loopback traffic is exempt. When the limit is reached the limiter returns
// apperr.ErrTooManyRequests so the global error handler renders the standard
// response envelope.
func RateLimit() fiber.Handler {
	return limiter.New(limiter.Config{
		Next: func(c fiber.Ctx) bool {
			return c.IP() == "127.0.0.1"
		},
		Max:        rateLimitMax,
		Expiration: rateLimitExpiration,
		LimitReached: func(c fiber.Ctx) error {
			return apperr.ErrTooManyRequests
		},
	})
}
