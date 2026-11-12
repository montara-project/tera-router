package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/lib/totp"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
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

// TestOIDCLoginRequiresFlow checks a login with no flow id is refused before
// the provider round-trip: a missing flow would mint an unbound ticket any
// browser could redeem.
func TestOIDCLoginRequiresFlow(t *testing.T) {
	h := &authHandler{app: &app.Application{Config: config.Config{OIDC: config.ConfigOIDC{
		Issuer: "https://id.example.com", ClientID: "id", ClientSecret: "secret",
	}}}}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/oidc/login", h.OIDCLogin)

	resp, err := f.Test(httptest.NewRequest("GET", "/oidc/login", nil))
	if err != nil {
		t.Fatalf("GET /oidc/login: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Fatalf("login without flow = %d, want 400", resp.StatusCode)
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

// TestOIDCVerifyTOTP gates the SSO session behind the account's TOTP factor:
// a pending entry survives a wrong code, a correct code spends it once, and
// the flow id must match the browser that began the sign-in.
func TestOIDCVerifyTOTP(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_totp_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Setenv("ADMIN_PASSWORD", "pw")
	seeders.RoleSeeder{DB: db}.Seed()
	seeders.AdminUserSeeder{DB: db}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatal(err)
	}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App), Secrets: secrets}}

	admin := uuid.MustParse("00000000-0000-0000-0000-0000000000ff")
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/oidc/verify-totp", h.OIDCVerifyTOTP)
	authed := f.Group("/", func(c fiber.Ctx) error { lib.ContextSetUID(c, admin); return c.Next() })
	authed.Post("/totp/setup", h.TOTPSetup)
	authed.Post("/totp/enable", h.TOTPEnable)

	call := func(body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest("POST", "/oidc/verify-totp", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST /oidc/verify-totp: %v", err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}
	post := func(path, body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest("POST", path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}

	// Enroll an authenticator on the seeded admin so the callback would have
	// parked this sign-in in oidcPending instead of opening a session.
	_, setup := post("/totp/setup", `{}`)
	secret, _ := setup["secret"].(string)
	now := time.Now()
	prev, cur := totp.Code(secret, now.Add(-30*time.Second)), totp.Code(secret, now)
	if status, _ := post("/totp/enable", `{"password":"pw","secret":"`+secret+`","code":"`+prev+`"}`); status != 200 {
		t.Fatalf("enable = %d", status)
	}
	user, err := h.app.Repos.Users.Get(t.Context(), admin.String())
	if err != nil || !user.TOTPEnabled {
		t.Fatalf("enrolled user: %v enabled=%v", err, user.TOTPEnabled)
	}

	if status, _ := call(`{"ticket":"nope","otp":"` + cur + `"}`); status != 401 {
		t.Fatalf("unknown ticket = %d, want 401", status)
	}
	if status, _ := call(`{"ticket":"nope","otp":""}`); status != 422 {
		t.Fatalf("missing otp = %d, want 422", status)
	}

	h.oidcPending.put("pend", ssoPending{userID: admin.String(), flow: "f1"}, time.Minute)
	if status, _ := call(`{"ticket":"pend","otp":"` + cur + `","flow":"wrong"}`); status != 401 {
		t.Fatalf("wrong flow = %d, want 401", status)
	}
	// A wrong code refuses but keeps the pending entry, so the next code can
	// still complete the sign-in.
	if status, _ := call(`{"ticket":"pend","otp":"000000","flow":"f1"}`); status != 401 {
		t.Fatalf("wrong code = %d, want 401", status)
	}
	if status, data := call(`{"ticket":"pend","otp":"` + cur + `","flow":"f1"}`); status != 200 || data["access_token"] == nil {
		t.Fatalf("correct code = %d %v, want 200 with access_token", status, data)
	}
	if status, _ := call(`{"ticket":"pend","otp":"` + cur + `","flow":"f1"}`); status != 401 {
		t.Fatalf("replayed pending ticket = %d, want 401", status)
	}

	h.oidcPending.put("stale", ssoPending{userID: admin.String()}, -time.Second)
	if status, _ := call(`{"ticket":"stale","otp":"` + cur + `"}`); status != 401 {
		t.Fatalf("expired pending = %d, want 401", status)
	}
}
