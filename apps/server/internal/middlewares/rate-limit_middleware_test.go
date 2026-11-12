package middlewares

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
)

// newRateLimitedApp wires RateLimit onto a bare app the way cmd/api does:
// dashboard paths are throttled while gateway and asset paths may be skipped.
func newRateLimitedApp(exemptLoopback bool, skipPaths func(string) bool, exemptIPs string, tunnelActive func() bool) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	app.Use(RateLimit(exemptLoopback, skipPaths, exemptIPs, tunnelActive))
	ok := func(c fiber.Ctx) error { return c.SendString("ok") }
	app.Get("/api/data", ok)
	app.Get("/v1/chat/completions", ok)
	app.Get("/assets/app.js", ok)
	return app
}

// status issues a request through app.Test. app.Test requests report peer
// address 0.0.0.0 (see TestIPBlockRestrictedAccess), so they exercise the
// remote-client path of the limiter.
func status(t *testing.T, app *fiber.App, path string) int {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil))
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	_ = resp.Body.Close()
	return resp.StatusCode
}

// TestRateLimitOverLimit: the rateLimitMax+1 request from one client IP gets
// the standard 429 envelope, not a generic 500.
func TestRateLimitOverLimit(t *testing.T) {
	app := newRateLimitedApp(false, nil, "", nil)

	for i := 0; i < rateLimitMax; i++ {
		if got := status(t, app, "/api/data"); got != fiber.StatusOK {
			t.Fatalf("request %d/%d = %d, want 200", i+1, rateLimitMax, got)
		}
	}

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/data", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("over-limit request = %d, want 429: %s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), "too many requests") {
		t.Errorf("429 body = %s, want the standard envelope", body)
	}
}

// TestRateLimitSkipPaths: paths with their own throttling (the inference
// gateway) and the hashed web-ui chunks skip the dashboard limiter entirely,
// matching the cmd/api wiring.
func TestRateLimitSkipPaths(t *testing.T) {
	skip := func(p string) bool { return strings.HasPrefix(p, "/v1/") || strings.HasPrefix(p, "/assets/") }
	app := newRateLimitedApp(false, skip, "", nil)

	for i := 0; i < rateLimitMax+20; i++ {
		if got := status(t, app, "/v1/chat/completions"); got != fiber.StatusOK {
			t.Fatalf("skip path request %d = %d, want 200", i+1, got)
		}
		if got := status(t, app, "/assets/app.js"); got != fiber.StatusOK {
			t.Fatalf("assets request %d = %d, want 200", i+1, got)
		}
	}
	// A non-skipped path is still governed.
	if got := status(t, app, "/api/data"); got != fiber.StatusOK {
		t.Fatalf("governed path = %d, want 200", got)
	}
}

// TestRateLimitExemptIPs: addresses on the exempt list bypass the limiter.
// app.Test's peer is 0.0.0.0, so exempting it frees the test client; the
// surrounding spaces also exercise the comma-list trimming.
func TestRateLimitExemptIPs(t *testing.T) {
	app := newRateLimitedApp(false, nil, " 0.0.0.0 , 10.1.2.3 ", nil)

	for i := 0; i < rateLimitMax+20; i++ {
		if got := status(t, app, "/api/data"); got != fiber.StatusOK {
			t.Fatalf("exempt request %d = %d, want 200", i+1, got)
		}
	}
}

// TestRateLimitLoopbackExemptOnlyForLoopback: exemptLoopback frees
// 127.0.0.1 only. app.Test's 0.0.0.0 peer is not loopback, so requests stay
// limited — a remote client must never ride the development exemption.
func TestRateLimitLoopbackExemptOnlyForLoopback(t *testing.T) {
	app := newRateLimitedApp(true, nil, "", nil)

	for i := 0; i < rateLimitMax; i++ {
		if got := status(t, app, "/api/data"); got != fiber.StatusOK {
			t.Fatalf("request %d = %d, want 200", i+1, got)
		}
	}
	if got := status(t, app, "/api/data"); got != fiber.StatusTooManyRequests {
		t.Fatalf("over-limit request = %d, want 429 (0.0.0.0 is not loopback)", got)
	}
}

// serve brings the app up on a real loopback listener so the peer address is
// 127.0.0.1 — app.Test can't reach the loopback and Cf-Connecting-IP paths.
func serve(t *testing.T, app *fiber.App) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true}) }()
	t.Cleanup(func() { _ = app.Shutdown() })
	return "http://" + ln.Addr().String()
}

func getStatus(t *testing.T, url, cfConnectingIP string) int {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if cfConnectingIP != "" {
		req.Header.Set("Cf-Connecting-IP", cfConnectingIP)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	_ = resp.Body.Close()
	return resp.StatusCode
}

// TestRateLimitLoopbackExempt: with the development flag on, a real loopback
// peer is never throttled.
func TestRateLimitLoopbackExempt(t *testing.T) {
	app := newRateLimitedApp(true, nil, "", nil)
	base := serve(t, app)

	for i := 0; i < rateLimitMax+20; i++ {
		if got := getStatus(t, base+"/api/data", ""); got != fiber.StatusOK {
			t.Fatalf("loopback request %d = %d, want 200", i+1, got)
		}
	}
}

// TestRateLimitTunnelKeysPerVisitor: while the tunnel is up, a loopback peer
// carrying Cf-Connecting-IP is keyed by the visitor address — so tunnel
// traffic stays limited per visitor even when loopback is exempt, and each
// visitor gets its own bucket.
func TestRateLimitTunnelKeysPerVisitor(t *testing.T) {
	tunnelUp := func() bool { return true }
	app := newRateLimitedApp(true, nil, "", tunnelUp)
	base := serve(t, app)

	for i := 0; i < rateLimitMax; i++ {
		if got := getStatus(t, base+"/api/data", "203.0.113.7"); got != fiber.StatusOK {
			t.Fatalf("visitor request %d = %d, want 200", i+1, got)
		}
	}
	if got := getStatus(t, base+"/api/data", "203.0.113.7"); got != fiber.StatusTooManyRequests {
		t.Fatalf("over-limit visitor request = %d, want 429 (visitors are not loopback-exempt)", got)
	}
	// A different visitor address has its own bucket.
	if got := getStatus(t, base+"/api/data", "198.51.100.23"); got != fiber.StatusOK {
		t.Fatalf("second visitor = %d, want 200", got)
	}
	// No header falls back to the loopback peer, which is exempt here.
	if got := getStatus(t, base+"/api/data", ""); got != fiber.StatusOK {
		t.Fatalf("headerless loopback request = %d, want 200", got)
	}
}

// TestRateLimitTunnelDownIgnoresHeader: with the tunnel down the header is
// untrusted — a loopback peer cannot forge a visitor identity; it stays
// keyed (and exempt) as 127.0.0.1.
func TestRateLimitTunnelDownIgnoresHeader(t *testing.T) {
	tunnelDown := func() bool { return false }
	app := newRateLimitedApp(true, nil, "", tunnelDown)
	base := serve(t, app)

	for i := 0; i < rateLimitMax+10; i++ {
		if got := getStatus(t, base+"/api/data", "203.0.113.7"); got != fiber.StatusOK {
			t.Fatalf("request %d with ignored header = %d, want 200", i+1, got)
		}
	}
}
