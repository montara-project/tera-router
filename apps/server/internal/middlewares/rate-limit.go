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
// When the limit is reached the limiter returns apperr.ErrTooManyRequests so
// the global error handler renders the standard response envelope.
//
// exemptLoopback skips the limiter for 127.0.0.1 and is meant for development
// only, where every request legitimately arrives from loopback. It must stay
// off in production: c.IP() reports the direct TCP peer (the server configures
// TrustProxy without a ProxyHeader, so forwarded headers are ignored), which
// means a same-host reverse proxy would make every request look like loopback
// and silently disable the limiter. Operators behind a proxy should configure
// ProxyHeader/TrustProxyConfig so the real client IP is used instead.
func RateLimit(exemptLoopback bool) fiber.Handler {
	return limiter.New(limiter.Config{
		Next: func(c fiber.Ctx) bool {
			return exemptLoopback && c.IP() == "127.0.0.1"
		},
		Max:        rateLimitMax,
		Expiration: rateLimitExpiration,
		LimitReached: func(c fiber.Ctx) error {
			return apperr.ErrTooManyRequests
		},
	})
}
