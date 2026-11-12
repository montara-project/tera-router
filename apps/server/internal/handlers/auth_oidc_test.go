package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestTTLStore pins the single-use semantics of the state and ticket stores:
// an entry is read once, and an expired entry reads as absent.
func TestTTLStore(t *testing.T) {
	var s ttlStore[string]

	s.put("a", "first", time.Minute)
	if v, ok := s.take("a"); !ok || v != "first" {
		t.Fatalf("take = %q %v, want first true", v, ok)
	}
	if _, ok := s.take("a"); ok {
		t.Fatal("second take of the same key succeeded; entries are single use")
	}
	if _, ok := s.take("missing"); ok {
		t.Fatal("take of an unknown key succeeded")
	}

	s.put("expired", "gone", -time.Second)
	if _, ok := s.take("expired"); ok {
		t.Fatal("take of an expired entry succeeded")
	}
}

// TestOIDCConfig checks the public config endpoint reflects whether all three
// OIDC settings are set.
func TestOIDCConfig(t *testing.T) {
	newApp := func(cfg config.Config) *fiber.App {
		h := &authHandler{app: &app.Application{Config: cfg}}
		f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
		f.Get("/oidc/config", h.OIDCConfig)
		return f
	}
	call := func(f *fiber.App) (int, map[string]any) {
		t.Helper()
		resp, err := f.Test(httptest.NewRequest("GET", "/oidc/config", nil))
		if err != nil {
			t.Fatalf("GET /oidc/config: %v", err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}

	full := config.Config{OIDC: config.ConfigOIDC{
		Issuer: "https://id.example.com", ClientID: "id", ClientSecret: "secret",
		ProviderName: "Pocket ID",
	}}
	if status, data := call(newApp(full)); status != 200 || data["enabled"] != true ||
		data["provider_name"] != "Pocket ID" {
		t.Fatalf("fully configured = %d %v, want 200 enabled:true provider_name:Pocket ID", status, data)
	}

	// A partial configuration cannot sign in, so the button must stay hidden.
	partial := config.Config{OIDC: config.ConfigOIDC{Issuer: "https://id.example.com", ClientID: "id"}}
	if status, data := call(newApp(partial)); status != 200 || data["enabled"] != false {
		t.Fatalf("partially configured = %d %v, want 200 enabled:false", status, data)
	}
	if status, data := call(newApp(config.Config{})); status != 200 || data["enabled"] != false {
		t.Fatalf("unconfigured = %d %v, want 200 enabled:false", status, data)
	}
}

// TestOIDCLoginDisabled checks the login endpoint answers 404 when SSO is not
// configured.
func TestOIDCLoginDisabled(t *testing.T) {
	h := &authHandler{app: &app.Application{Config: config.Config{}}}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/oidc/login", h.OIDCLogin)

	resp, err := f.Test(httptest.NewRequest("GET", "/oidc/login", nil))
	if err != nil {
		t.Fatalf("GET /oidc/login: %v", err)
	}
	if resp.StatusCode != 404 {
		t.Fatalf("disabled login = %d, want 404", resp.StatusCode)
	}
}

// TestOIDCExchange pins the ticket redemption: an unknown ticket is refused
// and a stored session payload comes back exactly once.
func TestOIDCExchange(t *testing.T) {
	h := &authHandler{app: &app.Application{Config: config.Config{}}}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/oidc/exchange", h.OIDCExchange)

	call := func(body string) int {
		t.Helper()
		req := httptest.NewRequest("POST", "/oidc/exchange", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST /oidc/exchange: %v", err)
		}
		return resp.StatusCode
	}

	if status := call(`{"ticket":"nope"}`); status != 401 {
		t.Fatalf("unknown ticket = %d, want 401", status)
	}

	h.oidcTickets.put("good", ssoTicket{view: fiber.Map{"access_token": "tok"}}, time.Minute)
	if status := call(`{"ticket":"good"}`); status != 200 {
		t.Fatalf("stored ticket = %d, want 200", status)
	}
	if status := call(`{"ticket":"good"}`); status != 401 {
		t.Fatalf("replayed ticket = %d, want 401", status)
	}

	// A bound ticket redeems only for the flow that began the sign-in.
	h.oidcTickets.put("bound", ssoTicket{view: fiber.Map{"access_token": "tok"}, flow: "f1"}, time.Minute)
	if status := call(`{"ticket":"bound","flow":"wrong"}`); status != 401 {
		t.Fatalf("wrong flow = %d, want 401", status)
	}
	h.oidcTickets.put("bound2", ssoTicket{view: fiber.Map{"access_token": "tok"}, flow: "f1"}, time.Minute)
	if status := call(`{"ticket":"bound2","flow":"f1"}`); status != 200 {
		t.Fatalf("matching flow = %d, want 200", status)
	}
}

// TestUIOriginFromReferer checks only http(s) scheme://host survives.
func TestUIOriginFromReferer(t *testing.T) {
	for in, want := range map[string]string{
		"https://dash.example.com/login?x=1": "https://dash.example.com",
		"http://localhost:5173/":             "http://localhost:5173",
		"":                                   "",
		"not a url":                          "",
		"ftp://dash.example.com/":            "",
		"//dash.example.com/path":            "",
	} {
		if got := uiOriginFromReferer(in); got != want {
			t.Errorf("uiOriginFromReferer(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestUIOriginAllowed pins which origins may receive the ticket redirect: the
// request's own origin and CORS-declared origins, never a wildcard or an
// undeclared site.
func TestUIOriginAllowed(t *testing.T) {
	const base = "https://api.example.com"
	const cors = "https://dash.example.com, http://localhost:5173"

	for _, tc := range []struct {
		name   string
		origin string
		base   string
		cors   string
		want   bool
	}{
		{"same origin", base, base, cors, true},
		{"cors origin", "https://dash.example.com", base, cors, true},
		{"cors origin with spaces", "http://localhost:5173", base, cors, true},
		{"undeclared origin", "https://evil.example.com", base, cors, false},
		{"wildcard is not an origin", "https://evil.example.com", base, "*", false},
		{"empty origin", "", base, cors, false},
		{"cors with trailing path does not match", "https://dash.example.com.evil.com", base, cors, false},
	} {
		if got := uiOriginAllowed(tc.origin, tc.base, tc.cors); got != tc.want {
			t.Errorf("%s: uiOriginAllowed(%q, %q, %q) = %v, want %v",
				tc.name, tc.origin, tc.base, tc.cors, got, tc.want)
		}
	}
}
