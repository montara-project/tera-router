package middlewares

import (
	"net/netip"
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
//
// tunnelActive, when non-nil, reports whether the Cloudflare tunnel is up.
// While it is, requests from loopback carrying Cf-Connecting-IP are keyed —
// and matched against the exemptions — by that visitor address instead of
// cloudflared's, so tunnel traffic is always limited per visitor, even in
// development. The header is ignored whenever the tunnel is down.
func RateLimit(exemptLoopback bool, skipPaths func(string) bool, exemptIPs string, tunnelActive func() bool) fiber.Handler {
	ipOf := func(c fiber.Ctx) string {
		return clientIP(c.IP(), c.Get("Cf-Connecting-IP"), tunnelActive != nil && tunnelActive())
	}
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
			ip := ipOf(c)
			if _, ok := exempt[ip]; ok {
				return true
			}
			return exemptLoopback && ip == "127.0.0.1"
		},
		KeyGenerator: ipOf,
		Max:          rateLimitMax,
		Expiration:   rateLimitExpiration,
		LimitReached: func(c fiber.Ctx) error {
			return apperr.ErrTooManyRequests
		},
	})
}

// clientIP resolves the address a request is rate-limited by. cloudflared
// connects from loopback and reports the visitor in Cf-Connecting-IP; that
// header is trusted only from a loopback peer while the tunnel is running, so
// a direct remote client cannot forge it. Anything else keeps the peer address.
func clientIP(peer, cfConnectingIP string, tunnelActive bool) string {
	if !tunnelActive || cfConnectingIP == "" {
		return peer
	}
	if addr, err := netip.ParseAddr(peer); err != nil || !addr.IsLoopback() {
		return peer
	}
	visitor, err := netip.ParseAddr(strings.TrimSpace(cfConnectingIP))
	if err != nil {
		return peer
	}
	return visitor.String()
}
