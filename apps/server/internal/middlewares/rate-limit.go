package middlewares

import (
	"strings"
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
// skipPaths, when non-nil, exempts paths that apply their own limiter — the
// inference gateway bounds in-flight concurrency rather than request count,
// because coding agents legitimately burst from a single address.
//
// exemptLoopback skips the limiter for 127.0.0.1 and is meant for development
// only, where every request legitimately arrives from loopback. It must stay
// off in production: unless --trusted-proxies is set, c.IP() reports the direct
// TCP peer and forwarded headers are ignored — a same-host reverse proxy would
// make every request look like the proxy's address. Operators behind a proxy
// should pass --trusted-proxies so the real client IP is used instead.
//
// exemptIPs is a comma-separated list of client IPs (e.g. internal health
// checks or an uptime monitor) that skip the limiter outright. Beware that
// c.IP() is the direct TCP peer: when every request arrives through a reverse
// proxy, exempting the proxy's address disables the limiter for all traffic.
func RateLimit(exemptLoopback bool, skipPaths func(string) bool, exemptIPs string) fiber.Handler {
	exempt := map[string]struct{}{}
	for _, ip := range strings.Split(exemptIPs, ",") {
		if ip = strings.TrimSpace(ip); ip != "" {
			exempt[ip] = struct{}{}
		}
	}
	return limiter.New(limiter.Config{
		Next: func(c fiber.Ctx) bool {
			if skipPaths != nil && skipPaths(c.Path()) {
				return true
			}
			if _, ok := exempt[c.IP()]; ok {
				return true
			}
			return exemptLoopback && c.IP() == "127.0.0.1"
		},
		Max:        rateLimitMax,
		Expiration: rateLimitExpiration,
		LimitReached: func(c fiber.Ctx) error {
			return apperr.ErrTooManyRequests
		},
	})
}
