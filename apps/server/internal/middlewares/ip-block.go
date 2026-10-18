package middlewares

import (
	"net/netip"
	"time"

	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

// signInPath is where failed attempts count toward an automatic block.
const signInPath = "/v1/auth/sign-in"

// IPBlock refuses requests from blocked addresses with 403 before any other
// work, and feeds failed sign-ins to the guard so brute-force sources get a
// temporary block. The client address is resolved like the rate limiter does
// (Cf-Connecting-IP only through a running tunnel) and stored for handlers.
func IPBlock(guard *ipblock.Guard, tunnelActive func() bool) fiber.Handler {
	return func(c fiber.Ctx) error {
		ip, err := netip.ParseAddr(clientIP(c.IP(), c.Get("Cf-Connecting-IP"), tunnelActive != nil && tunnelActive()))
		if err != nil {
			return c.Next()
		}
		lib.ContextSetClientIP(c, ip)
		if guard.Blocked(ip, time.Now()) {
			return apperr.ErrForbidden
		}

		err = c.Next()
		if c.Method() == fiber.MethodPost && c.Path() == signInPath {
			// The error may still be propagating, or an inner middleware may
			// already have rendered it; read the status either way.
			status := c.Response().StatusCode()
			if err != nil {
				status, _ = apperr.From(err)
			}
			if status == fiber.StatusUnauthorized {
				_ = guard.Fail(c.Context(), ip, time.Now())
			}
		}
		return err
	}
}
