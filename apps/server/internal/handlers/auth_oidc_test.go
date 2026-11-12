package handlers

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/password"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/lib/totp"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
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
		data["provider_name"] != "Pocket ID" || data["password_login"] != true {
		t.Fatalf("fully configured = %d %v, want 200 enabled:true provider_name:Pocket ID password_login:true", status, data)
	}

	// OIDC_DISABLE_PASSWORD_LOGIN reports password_login:false — but only
	// while SSO is actually enabled.
	noPassword := full
	noPassword.OIDC.DisablePasswordLogin = true
	if status, data := call(newApp(noPassword)); status != 200 || data["password_login"] != false {
		t.Fatalf("password login disabled = %d %v, want 200 password_login:false", status, data)
	}
	noPasswordNoOIDC := config.Config{OIDC: config.ConfigOIDC{DisablePasswordLogin: true}}
	if status, data := call(newApp(noPasswordNoOIDC)); status != 200 || data["password_login"] != true {
		t.Fatalf("flag without OIDC = %d %v, want 200 password_login:true", status, data)
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
	t.Setenv("ADMIN_PASSWORD", "test-password")
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
	if status, _ := post("/totp/enable", `{"password":"test-password","secret":"`+secret+`","code":"`+prev+`"}`); status != 200 {
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

	// Wrong guesses count against the pending entry across requests; once the
	// cap is reached the ticket is spent, so even the right code is refused.
	h.oidcPending.put("guessed", ssoPending{userID: admin.String()}, time.Minute)
	for i := 0; i < oidcTOTPMaxAttempts; i++ {
		if status, _ := call(`{"ticket":"guessed","otp":"000000"}`); status != 401 {
			t.Fatalf("wrong code %d = %d, want 401", i+1, status)
		}
	}
	if status, _ := call(`{"ticket":"guessed","otp":"` + totp.Code(secret, time.Now()) + `"}`); status != 401 {
		t.Fatalf("post-cap correct code = %d, want 401", status)
	}
}

// fakeIdP is a minimal OIDC provider for the callback test: discovery
// metadata, a token endpoint that hands back a freshly signed id_token, and
// the JWKS the verifier fetches for it.
type fakeIdP struct {
	srv           *httptest.Server
	key           *rsa.PrivateKey
	nonce         string
	email         string
	name          string
	sub           string
	emailVerified bool
}

func newFakeIdP(t *testing.T, nonce, email string) *fakeIdP {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	f := &fakeIdP{key: key, nonce: nonce, email: email, sub: "idp-user", emailVerified: true}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"issuer":                 f.srv.URL,
				"authorization_endpoint": f.srv.URL + "/auth",
				"token_endpoint":         f.srv.URL + "/token",
				"jwks_uri":               f.srv.URL + "/keys",
			})
		case "/token":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "at", "token_type": "Bearer", "id_token": f.idToken(),
			})
		case "/keys":
			_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]any{{
				"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "k1",
				"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
			}}})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeIdP) idToken() string {
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": f.srv.URL, "sub": f.sub, "aud": "id",
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(),
		"nonce": f.nonce, "email": f.email, "email_verified": f.emailVerified,
		"name": f.name,
	})
	tok.Header["kid"] = "k1"
	signed, err := tok.SignedString(f.key)
	if err != nil {
		panic(err)
	}
	return signed
}

// TestOIDCCallbackPendingTOTP drives the callback against a controlled IdP: a
// TOTP-enabled account is parked as a pending ticket with no session opened,
// and a correct code at /oidc/verify-totp then opens it.
func TestOIDCCallbackPendingTOTP(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_callback_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Setenv("ADMIN_PASSWORD", "test-password")
	seeders.RoleSeeder{DB: db}.Seed()
	seeders.AdminUserSeeder{DB: db}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatal(err)
	}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App), Secrets: secrets}}

	ctx := t.Context()
	admin, err := h.app.Repos.Users.GetByEmail(ctx, "admin@tera.local")
	if err != nil {
		t.Fatalf("seeded admin: %v", err)
	}

	// Enroll the factor directly: last step is the previous window's, so the
	// current window's code is still redeemable below.
	secret, err := totp.NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := h.app.Secrets.SealString(secret, sealer.PurposeUserTOTP)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	step, ok := totp.Verify(secret, totp.Code(secret, now.Add(-30*time.Second)), now)
	if !ok {
		t.Fatal("enrollment code did not verify")
	}
	if err := h.app.Repos.Users.SetTOTP(ctx, admin.ID, sealed.WrappedDEK, sealed.Ciphertext, step); err != nil {
		t.Fatalf("set totp: %v", err)
	}

	idp := newFakeIdP(t, "n1", "admin@tera.local")
	h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}
	h.oidcStates.put("st", oidcState{nonce: "n1", verifier: oauth2.GenerateVerifier(), uiOrigin: "", flow: "f1"}, oidcStateTTL)

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/oidc/callback", h.OIDCCallback)
	f.Post("/oidc/verify-totp", h.OIDCVerifyTOTP)

	resp, err := f.Test(httptest.NewRequest("GET", "/oidc/callback?state=st&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback: %v", err)
	}
	loc, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse redirect: %v", err)
	}
	ticket := loc.Query().Get("sso_totp")
	if resp.StatusCode != 302 || ticket == "" {
		t.Fatalf("callback = %d %q, want 302 with sso_totp", resp.StatusCode, loc.String())
	}

	// The verified identity is pending the second factor: no session exists.
	if rows, err := h.app.Repos.Refresh.ListActive(ctx, admin.ID); err != nil || len(rows) != 0 {
		t.Fatalf("sessions before totp = %d %v, want 0", len(rows), err)
	}

	body := `{"ticket":"` + ticket + `","otp":"` + totp.Code(secret, time.Now()) + `","flow":"f1"}`
	req := httptest.NewRequest("POST", "/oidc/verify-totp", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	vresp, err := f.Test(req)
	if err != nil {
		t.Fatalf("POST /oidc/verify-totp: %v", err)
	}
	var out map[string]any
	_ = json.NewDecoder(vresp.Body).Decode(&out)
	data, _ := out["data"].(map[string]any)
	if vresp.StatusCode != 200 || data["access_token"] == nil {
		t.Fatalf("verify-totp = %d %v, want 200 with access_token", vresp.StatusCode, out)
	}
	if rows, err := h.app.Repos.Refresh.ListActive(ctx, admin.ID); err != nil || len(rows) != 1 {
		t.Fatalf("sessions after totp = %d %v, want 1", len(rows), err)
	}
}

// TestOIDCCallbackProvisionsUser drives the callback for an email the IdP
// vouches for but no account holds: the user is created with the "user" role,
// a session ticket is issued, and no password ever signs the account in.
func TestOIDCCallbackProvisionsUser(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_provision_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	seeders.RoleSeeder{DB: db}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}}

	idp := newFakeIdP(t, "n1", "new@example.com")
	idp.name = "New Person"
	idp.sub = "sub-new"
	h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}
	h.oidcStates.put("st", oidcState{nonce: "n1", verifier: oauth2.GenerateVerifier(), uiOrigin: "", flow: "f1"}, oidcStateTTL)

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/oidc/callback", h.OIDCCallback)
	f.Post("/oidc/exchange", h.OIDCExchange)

	resp, err := f.Test(httptest.NewRequest("GET", "/oidc/callback?state=st&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback: %v", err)
	}
	loc, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse redirect: %v", err)
	}
	if resp.StatusCode != 302 || loc.Query().Get("sso_ticket") == "" {
		t.Fatalf("callback = %d %q, want 302 with sso_ticket", resp.StatusCode, loc.String())
	}

	ctx := t.Context()
	user, err := h.app.Repos.Users.GetByEmail(ctx, "new@example.com")
	if err != nil {
		t.Fatalf("provisioned user: %v", err)
	}
	if user.Role.Name != "user" || !user.IsActive || user.IsBlocked || user.Fullname != "New Person" ||
		user.OIDCSub != "sub-new" || user.OIDCIss != idp.srv.URL {
		t.Fatalf("provisioned user = %+v, want active user role named New Person linked to idp sub-new", user)
	}
	if ok, err := password.Verify("new@example.com", user.PasswordHash); err != nil || ok {
		t.Fatalf("provisioned password verified: ok=%v err=%v", ok, err)
	}

	// The ticket redeems for a session of the provisioned account.
	req := httptest.NewRequest("POST", "/oidc/exchange", strings.NewReader(
		`{"ticket":"`+loc.Query().Get("sso_ticket")+`","flow":"f1"}`))
	req.Header.Set("Content-Type", "application/json")
	xresp, err := f.Test(req)
	if err != nil {
		t.Fatalf("POST /oidc/exchange: %v", err)
	}
	var out map[string]any
	_ = json.NewDecoder(xresp.Body).Decode(&out)
	data, _ := out["data"].(map[string]any)
	if xresp.StatusCode != 200 || data["access_token"] == nil || data["email"] != "new@example.com" {
		t.Fatalf("exchange = %d %v, want 200 with session", xresp.StatusCode, out)
	}

	// A second sign-in for the same email reuses the account instead of
	// provisioning another one.
	h.oidcStates.put("st2", oidcState{nonce: "n1", verifier: oauth2.GenerateVerifier(), uiOrigin: "", flow: "f1"}, oidcStateTTL)
	resp2, err := f.Test(httptest.NewRequest("GET", "/oidc/callback?state=st2&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback (2): %v", err)
	}
	loc2, _ := url.Parse(resp2.Header.Get("Location"))
	if resp2.StatusCode != 302 || loc2.Query().Get("sso_ticket") == "" {
		t.Fatalf("second callback = %d %q, want 302 with sso_ticket", resp2.StatusCode, loc2.String())
	}
	again, err := h.app.Repos.Users.GetByEmail(ctx, "new@example.com")
	if err != nil || again.ID != user.ID {
		t.Fatalf("second sign-in user = %v %v, want same account %s", again.ID, err, user.ID)
	}
}

// ssoCallbackFixture bundles the shared callback-test plumbing: a migrated
// database with roles seeded, a wired handler, and the fiber app serving
// /oidc/callback.
type ssoCallbackFixture struct {
	h *authHandler
	f *fiber.App
}

func newSSOCallbackFixture(t *testing.T, oidc config.ConfigOIDC) *ssoCallbackFixture {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_link_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	seeders.RoleSeeder{DB: db}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}, OIDC: oidc}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/oidc/callback", h.OIDCCallback)
	return &ssoCallbackFixture{h: h, f: f}
}

// callCallback drives one provider round-trip against the fake IdP and
// returns the redirect's query values.
func (fx *ssoCallbackFixture) callCallback(t *testing.T, state string) url.Values {
	t.Helper()
	fx.h.oidcStates.put(state, oidcState{nonce: "n1", verifier: oauth2.GenerateVerifier(), uiOrigin: "", flow: "f1"}, oidcStateTTL)
	resp, err := fx.f.Test(httptest.NewRequest("GET", "/oidc/callback?state="+state+"&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback: %v", err)
	}
	loc, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse redirect: %v", err)
	}
	if resp.StatusCode != 302 {
		t.Fatalf("callback = %d, want 302", resp.StatusCode)
	}
	return loc.Query()
}

// TestOIDCCallbackLinksExistingAccount pins OIDC_LINK_EXISTING_ACCOUNTS: an
// IdP-verified email matching a pre-existing account binds the subject to it
// (audit-logged), and later sign-ins match by sub even when the email moved.
func TestOIDCCallbackLinksExistingAccount(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	t.Setenv("ADMIN_PASSWORD", "test-password")
	seeders.AdminUserSeeder{DB: fx.h.app.DB}.Seed()

	idp := newFakeIdP(t, "n1", "admin@tera.local")
	idp.sub = "admin-sub"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_ticket") == "" {
		t.Fatalf("callback = %v, want sso_ticket", q)
	}
	admin, err := fx.h.app.Repos.Users.GetByEmail(t.Context(), "admin@tera.local")
	if err != nil || admin.OIDCSub != "admin-sub" || admin.OIDCIss != idp.srv.URL {
		t.Fatalf("linked admin: iss=%q sub=%q err=%v", admin.OIDCIss, admin.OIDCSub, err)
	}

	// The email may later change at the provider; the subject still resolves.
	idp.email = "renamed@tera.local"
	if q := fx.callCallback(t, "st2"); q.Get("sso_ticket") == "" {
		t.Fatalf("second callback = %v, want sso_ticket via sub match", q)
	}
}

// TestOIDCCallbackLinkDisabled pins the off side: an existing account that
// carries no linked subject is refused instead of being silently linked.
func TestOIDCCallbackLinkDisabled(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	t.Setenv("ADMIN_PASSWORD", "test-password")
	seeders.AdminUserSeeder{DB: fx.h.app.DB}.Seed()

	idp := newFakeIdP(t, "n1", "admin@tera.local")
	idp.sub = "admin-sub"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: false,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_error") != "not_linked" {
		t.Fatalf("callback = %v, want sso_error=not_linked", q)
	}
	// A brand-new email still provisions — linking governs existing rows only.
	idp.email, idp.sub = "new@example.com", "sub-new"
	if q := fx.callCallback(t, "st2"); q.Get("sso_ticket") == "" {
		t.Fatalf("new email callback = %v, want sso_ticket", q)
	}
}

// TestOIDCCallbackEmailVerifiedFlag gates the email_verified requirement:
// the flag on refuses unverified emails, off lets them provision.
func TestOIDCCallbackEmailVerifiedFlag(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	idp := newFakeIdP(t, "n1", "unverified@example.com")
	idp.emailVerified = false
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_error") != "email_unverified" {
		t.Fatalf("required callback = %v, want sso_error=email_unverified", q)
	}

	fx.h.app.Config.OIDC.RequireEmailVerified = false
	if q := fx.callCallback(t, "st2"); q.Get("sso_ticket") == "" {
		t.Fatalf("optional callback = %v, want sso_ticket", q)
	}
}

// TestSignInDisabledWithOIDCFlag pins OIDC_DISABLE_PASSWORD_LOGIN: with a
// working provider the password endpoint refuses; without one the flag is
// inert so nobody gets locked out.
func TestSignInDisabledWithOIDCFlag(t *testing.T) {
	newApp := func(oidc config.ConfigOIDC) *fiber.App {
		h := &authHandler{app: &app.Application{Config: config.Config{OIDC: oidc}}}
		f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
		f.Post("/sign-in", h.SignIn)
		return f
	}
	call := func(f *fiber.App) int {
		t.Helper()
		req := httptest.NewRequest("POST", "/sign-in", strings.NewReader(`{"email":"a@b.c","password":"x"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST /sign-in: %v", err)
		}
		return resp.StatusCode
	}

	disabled := config.ConfigOIDC{
		Issuer: "https://id.example.com", ClientID: "id", ClientSecret: "secret",
		DisablePasswordLogin: true,
	}
	if status := call(newApp(disabled)); status != 403 {
		t.Fatalf("disabled sign-in = %d, want 403", status)
	}
	// The flag alone cannot lock the dashboard: no provider, no refusal.
	// The request falls through to validation, which 422s the bad body.
	if status := call(newApp(config.ConfigOIDC{DisablePasswordLogin: true})); status != 422 {
		t.Fatalf("flag without provider = %d, want 422", status)
	}
}

// insertSSOUser creates a role-"user" account directly, with the given linked
// identity ("" links nothing). The password is a valid hash of a throwaway
// string, like a provisioned account's.
func insertSSOUser(t *testing.T, h *authHandler, email, iss, sub string) models.User {
	t.Helper()
	ctx := t.Context()
	roleID, err := h.app.Repos.Users.RoleIDByName(ctx, "user")
	if err != nil {
		t.Fatalf("role: %v", err)
	}
	hash, err := password.Hash(uuid.NewString())
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	u := models.User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: hash,
		IsActive:     true,
		RoleID:       roleID,
		OIDCIss:      iss,
		OIDCSub:      sub,
	}
	if err := h.app.Repos.Users.Insert(ctx, u); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return u
}

// TestOIDCCallbackEmailCaseFold pins the email fallback's case-insensitive
// match: a provider that spells the mailbox differently than the stored row
// still resolves the one existing account and links it.
func TestOIDCCallbackEmailCaseFold(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	u := insertSSOUser(t, fx.h, "Admin@Tera.local", "", "")

	idp := newFakeIdP(t, "n1", "admin@tera.local")
	idp.sub = "case-sub"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_ticket") == "" {
		t.Fatalf("callback = %v, want sso_ticket", q)
	}
	linked, err := fx.h.app.Repos.Users.GetByEmail(t.Context(), "Admin@Tera.local")
	if err != nil || linked.OIDCSub != "case-sub" || linked.ID != u.ID {
		t.Fatalf("linked user: id=%s sub=%q err=%v", linked.ID, linked.OIDCSub, err)
	}
}

// TestOIDCCallbackAmbiguousEmailVariants refuses a sign-in whose email
// resolves to more than one stored case variant — pre-existing duplicates
// must never pick an account arbitrarily.
func TestOIDCCallbackAmbiguousEmailVariants(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	insertSSOUser(t, fx.h, "Case@dup.local", "", "")
	insertSSOUser(t, fx.h, "case@dup.local", "", "")

	idp := newFakeIdP(t, "n1", "CASE@dup.local")
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_error") != "internal" {
		t.Fatalf("callback = %v, want sso_error=internal", q)
	}
}

// TestOIDCCallbackIssuerMismatch pins issuer scoping: a link recorded under a
// different issuer is not matched by the same sub from this provider, and the
// email fallback refuses to overwrite or enter it.
func TestOIDCCallbackIssuerMismatch(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	insertSSOUser(t, fx.h, "swap@example.com", "https://old-issuer.example.com", "shared-sub")

	idp := newFakeIdP(t, "n1", "swap@example.com")
	idp.sub = "shared-sub"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_error") != "not_linked" {
		t.Fatalf("callback = %v, want sso_error=not_linked", q)
	}
	stored, err := fx.h.app.Repos.Users.GetByEmail(t.Context(), "swap@example.com")
	if err != nil || stored.OIDCIss != "https://old-issuer.example.com" {
		t.Fatalf("link was overwritten: iss=%q err=%v", stored.OIDCIss, err)
	}
}

// TestOIDCCallbackLegacyIssuerLink pins the upgrade path: a link written
// before the issuer column existed keeps a NULL issuer with the subject, and
// the same subject returning is still the account's own identity — even when
// linking new accounts is off, since this one was linked already. The
// sign-in fills the issuer for the next lookup.
func TestOIDCCallbackLegacyIssuerLink(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	u := insertSSOUser(t, fx.h, "legacy@example.com", "", "idp-user")

	idp := newFakeIdP(t, "n1", "legacy@example.com")
	idp.sub = "idp-user"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: false,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_ticket") == "" {
		t.Fatalf("callback = %v, want sso_ticket for the legacy-linked account", q)
	}
	stored, err := fx.h.app.Repos.Users.GetByEmail(t.Context(), "legacy@example.com")
	if err != nil || stored.ID != u.ID || stored.OIDCIss != idp.srv.URL || stored.OIDCSub != "idp-user" {
		t.Fatalf("legacy link not healed: iss=%q sub=%q err=%v", stored.OIDCIss, stored.OIDCSub, err)
	}
}

// TestLinkOIDC pins the conditional write: a link attaches only to an
// unlinked row, the same pair replays as success, a different pair conflicts,
// and a NULL issuer left by the pre-pair schema heals on the next sign-in.
func TestLinkOIDC(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	ctx := t.Context()
	repo := fx.h.app.Repos.Users

	u := insertSSOUser(t, fx.h, "link@example.com", "", "")
	if err := repo.LinkOIDC(ctx, u.ID, "iss-a", "sub-1"); err != nil {
		t.Fatalf("first link: %v", err)
	}
	if err := repo.LinkOIDC(ctx, u.ID, "iss-a", "sub-1"); err != nil {
		t.Fatalf("same-pair relink: %v", err)
	}
	if err := repo.LinkOIDC(ctx, u.ID, "iss-a", "sub-2"); err == nil {
		t.Fatal("different subject overwrote the link")
	}
	if err := repo.LinkOIDC(ctx, u.ID, "iss-b", "sub-1"); err == nil {
		t.Fatal("different issuer overwrote the link")
	}

	// A row linked before issuers were recorded keeps oidc_iss NULL; the next
	// sign-in claims it without failing.
	v := insertSSOUser(t, fx.h, "heal@example.com", "", "")
	if _, err := fx.h.app.DB.ExecContext(ctx,
		`UPDATE users SET oidc_sub = 'sub-9', oidc_iss = NULL WHERE id = $1`, v.ID); err != nil {
		t.Fatalf("seed pre-pair link: %v", err)
	}
	if err := repo.LinkOIDC(ctx, v.ID, "iss-a", "sub-9"); err != nil {
		t.Fatalf("heal link: %v", err)
	}
	healed, err := repo.Get(ctx, v.ID)
	if err != nil || healed.OIDCIss != "iss-a" || healed.OIDCSub != "sub-9" {
		t.Fatalf("healed link: iss=%q sub=%q err=%v", healed.OIDCIss, healed.OIDCSub, err)
	}
}

// TestProvisionOIDCUserRace pins the insert-conflict fallback: a row that
// appears between the email lookup and the INSERT is usable only when this
// identity owns it already, or when it is still unlinked and linking is on —
// never silently borrowed from a different sign-in.
func TestProvisionOIDCUserRace(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: "https://idp", ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}
	fx.f.Post("/prov", func(c fiber.Ctx) error {
		u, err := fx.h.provisionOIDCUser(c, "race@example.com", "Racer", "iss-a", "sub-b")
		if err != nil {
			return err
		}
		return dtos.OK(c, fiber.Map{"id": u.ID, "iss": u.OIDCIss, "sub": u.OIDCSub})
	})
	call := func() (int, map[string]any) {
		t.Helper()
		resp, err := fx.f.Test(httptest.NewRequest("POST", "/prov", nil))
		if err != nil {
			t.Fatalf("POST /prov: %v", err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}
	deleteUsers := func() {
		t.Helper()
		if _, err := fx.h.app.DB.ExecContext(t.Context(), `DELETE FROM users WHERE email = 'race@example.com'`); err != nil {
			t.Fatalf("cleanup: %v", err)
		}
	}

	// The row already carries this identity's pair: the insert lost to this
	// same callback's retry, so accepting it is idempotent.
	insertSSOUser(t, fx.h, "race@example.com", "iss-a", "sub-b")
	if status, data := call(); status != 200 || data["sub"] != "sub-b" {
		t.Fatalf("same pair = %d %v, want 200 sub-b", status, data)
	}

	// The row carries a different identity: a racing callback won. Entering
	// it anyway would hand this subject the other identity's session.
	deleteUsers()
	insertSSOUser(t, fx.h, "race@example.com", "iss-a", "sub-a")
	if status, _ := call(); status != 409 {
		t.Fatalf("different pair = %d, want 409", status)
	}

	// An unlinked row honors the linking flag.
	deleteUsers()
	u := insertSSOUser(t, fx.h, "race@example.com", "", "")
	if status, data := call(); status != 200 || data["sub"] != "sub-b" {
		t.Fatalf("unlinked + linking on = %d %v, want 200 sub-b", status, data)
	}
	linked, err := fx.h.app.Repos.Users.Get(t.Context(), u.ID)
	if err != nil || linked.OIDCSub != "sub-b" {
		t.Fatalf("unlinked row was not linked: %v", err)
	}

	deleteUsers()
	insertSSOUser(t, fx.h, "race@example.com", "", "")
	fx.h.app.Config.OIDC.LinkExistingAccounts = false
	if status, _ := call(); status != 409 {
		t.Fatalf("unlinked + linking off = %d, want 409", status)
	}
	fx.h.app.Config.OIDC.LinkExistingAccounts = true
}

// TestProvisionOIDCUserCaseVariants pins the conditional insert: two
// callbacks whose emails differ only by case cannot create twin accounts —
// the case-sensitive unique index would admit them both, so the INSERT
// itself checks the folded email and the loser resolves the winner's row.
func TestProvisionOIDCUserCaseVariants(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: "https://idp", ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}
	var email, sub string
	fx.f.Post("/prov", func(c fiber.Ctx) error {
		u, err := fx.h.provisionOIDCUser(c, email, "Variant", "iss-a", sub)
		if err != nil {
			return err
		}
		return dtos.OK(c, fiber.Map{"id": u.ID})
	})
	call := func() (int, map[string]any) {
		t.Helper()
		resp, err := fx.f.Test(httptest.NewRequest("POST", "/prov", nil))
		if err != nil {
			t.Fatalf("POST /prov: %v", err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}

	email, sub = "Variant@dup.local", "sub-v"
	status, first := call()
	if status != 200 || first["id"] == nil {
		t.Fatalf("first variant = %d %v, want 200", status, first)
	}

	// A different case spelling carrying a different identity: the insert is
	// skipped and the stored row's pair does not match.
	email, sub = "variant@dup.local", "sub-w"
	if status, _ := call(); status != 409 {
		t.Fatalf("case variant = %d, want 409", status)
	}

	// Exactly one live row exists for the folded email — the fold itself
	// would conflict had a twin been created.
	stored, err := fx.h.app.Repos.Users.GetByEmailFold(t.Context(), "variant@dup.local")
	if err != nil || stored.ID != first["id"] || stored.OIDCSub != "sub-v" {
		t.Fatalf("folded row = %v %q, want the one provisioned account", stored.ID, err)
	}

	// The same pair retrying under a different case spelling is idempotent.
	email, sub = "VARIANT@dup.local", "sub-v"
	resp, err := fx.f.Test(httptest.NewRequest("POST", "/prov", nil))
	if err != nil {
		t.Fatalf("POST /prov2: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("same-pair case retry = %d, want 200", resp.StatusCode)
	}
}

// TestOIDCCallbackBlockedAccountNoLink pins the status check order: a
// provider-verified email matching an inactive or blocked account is refused
// without writing the link first — a stored sub would wait for reactivation
// and then sign in.
func TestOIDCCallbackBlockedAccountNoLink(t *testing.T) {
	fx := newSSOCallbackFixture(t, config.ConfigOIDC{})
	ctx := t.Context()
	roleID, err := fx.h.app.Repos.Users.RoleIDByName(ctx, "user")
	if err != nil {
		t.Fatalf("role: %v", err)
	}
	hash, _ := password.Hash(uuid.NewString())
	blocked := models.User{
		ID: uuid.NewString(), Email: "blocked@example.com", PasswordHash: hash,
		IsActive: true, IsBlocked: true, RoleID: roleID,
	}
	if err := fx.h.app.Repos.Users.Insert(ctx, blocked); err != nil {
		t.Fatalf("insert blocked user: %v", err)
	}

	idp := newFakeIdP(t, "n1", "blocked@example.com")
	idp.sub = "blocked-sub"
	fx.h.app.Config.OIDC = config.ConfigOIDC{
		Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
		RequireEmailVerified: true, LinkExistingAccounts: true,
	}

	if q := fx.callCallback(t, "st"); q.Get("sso_error") != "no_account" {
		t.Fatalf("callback = %v, want sso_error=no_account", q)
	}
	stored, err := fx.h.app.Repos.Users.Get(ctx, blocked.ID)
	if err != nil || stored.OIDCSub != "" {
		t.Fatalf("blocked account was linked: sub=%q err=%v", stored.OIDCSub, err)
	}
}

// TestPasskeySignInDisabled pins OIDC_DISABLE_PASSWORD_LOGIN covering the
// public passkey endpoints too: when SSO is the only way in, begin and finish
// refuse before any ceremony work.
func TestPasskeySignInDisabled(t *testing.T) {
	newApp := func(oidc config.ConfigOIDC) *fiber.App {
		pk := &passkeysHandler{app: &app.Application{Config: config.Config{OIDC: oidc}}}
		f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
		f.Post("/passkey/begin", pk.SignInBegin)
		f.Post("/passkey/finish", pk.SignInFinish)
		return f
	}
	call := func(f *fiber.App, path string) int {
		t.Helper()
		req := httptest.NewRequest("POST", path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST %s: %v", path, err)
		}
		return resp.StatusCode
	}

	disabled := config.ConfigOIDC{
		Issuer: "https://id.example.com", ClientID: "id", ClientSecret: "secret",
		DisablePasswordLogin: true,
	}
	f := newApp(disabled)
	if status := call(f, "/passkey/begin"); status != 403 {
		t.Fatalf("begin = %d, want 403", status)
	}
	if status := call(f, "/passkey/finish"); status != 403 {
		t.Fatalf("finish = %d, want 403", status)
	}
}

// TestSSOReauth pins the empty-password path: a session opened moments ago by
// SSO on a linked account satisfies reauthentication, while a password-method
// TestSSOReauth exercises the passwordless reauth path: only a one-use
// ticket minted for this account by a fresh provider ceremony substitutes
// for the password — the bearer session itself never counts.
func TestSSOReauth(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_reauth_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	seeders.RoleSeeder{DB: db}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatal(err)
	}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App), Secrets: secrets}}

	linked := insertSSOUser(t, h, "sso@example.com", "iss-a", "sub-1")
	unlinked := insertSSOUser(t, h, "plain@example.com", "", "")
	other := insertSSOUser(t, h, "sso2@example.com", "iss-a", "sub-2")

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	var uid string
	authed := f.Group("/", func(c fiber.Ctx) error {
		lib.ContextSetUID(c, uuid.MustParse(uid))
		return c.Next()
	})
	authed.Post("/totp/enable", h.TOTPEnable)
	bh := &backupHandler{app: h.app}
	authed.Post("/db", bh.DatabaseDownload)

	call := func(user models.User, password, secret, code, ticket string) int {
		t.Helper()
		uid = user.ID
		req := httptest.NewRequest("POST", "/totp/enable", strings.NewReader(
			`{"password":"`+password+`","secret":"`+secret+`","code":"`+code+`","reauth_ticket":"`+ticket+`"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST /totp/enable: %v", err)
		}
		return resp.StatusCode
	}
	download := func(user models.User, ticket string) int {
		t.Helper()
		uid = user.ID
		req := httptest.NewRequest("POST", "/db", strings.NewReader(
			`{"password":"","reauth_ticket":"`+ticket+`"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("POST /db: %v", err)
		}
		return resp.StatusCode
	}

	// A ticket minted for the linked account stands in for the password it
	// does not have.
	secret, err := totp.NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	code := totp.Code(secret, time.Now())
	oidcReauths.put("tk-good", linked.ID, oidcReauthTTL)
	if status := call(linked, "", secret, code, "tk-good"); status != 200 {
		t.Fatalf("ticket reauth enable = %d, want 200", status)
	}

	// The ticket is single-use: a replay of the same one is refused. The
	// account under test carries no TOTP — "linked" enrolled one above, so a
	// ticket path for it would now owe the second factor instead of failing.
	oidcReauths.put("tk-dl", other.ID, oidcReauthTTL)
	if status := download(other, "tk-dl"); status != 200 {
		t.Fatalf("ticket download = %d, want 200", status)
	}
	if status := download(other, "tk-dl"); status != 422 {
		t.Fatalf("replayed ticket = %d, want 422", status)
	}

	// A ticket minted for somebody else does not reauthenticate this account.
	// The download endpoint changes nothing between calls, so it isolates the
	// reauth decision — TOTPEnable would short-circuit on an enabled factor.
	oidcReauths.put("tk-other", other.ID, oidcReauthTTL)
	if status := download(linked, "tk-other"); status != 422 {
		t.Fatalf("foreign ticket = %d, want 422", status)
	}

	// An expired ticket no longer counts.
	oidcReauths.put("tk-stale", linked.ID, -time.Second)
	if status := download(linked, "tk-stale"); status != 422 {
		t.Fatalf("stale ticket = %d, want 422", status)
	}

	// No ticket at all: an empty password never reauthenticates, however the
	// session was opened.
	if status := download(linked, ""); status != 422 {
		t.Fatalf("empty password, no ticket = %d, want 422", status)
	}

	// An unlinked account cannot use the ticket path even with a ticket minted
	// for it — the provider link is what the ticket substitutes for.
	oidcReauths.put("tk-unlinked", unlinked.ID, oidcReauthTTL)
	if status := download(unlinked, "tk-unlinked"); status != 422 {
		t.Fatalf("unlinked account = %d, want 422", status)
	}
}

// TestOIDCReauthFlow drives the step-up ceremony: /oidc/reauth sends the
// linked user to the provider for a fresh login, the callback mints a one-use
// ticket the reauth dialog then spends — and a ceremony returning a different
// identity mints nothing.
func TestOIDCReauthFlow(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sso_reauth_flow_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	seeders.RoleSeeder{DB: db}.Seed()

	idp := newFakeIdP(t, "n1", "sso@example.com")
	cfg := config.Config{
		App: config.ConfigApp{Secret: "test-secret"},
		OIDC: config.ConfigOIDC{
			Issuer: idp.srv.URL, ClientID: "id", ClientSecret: "secret",
			RequireEmailVerified: true, LinkExistingAccounts: true,
		},
	}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatal(err)
	}
	h := &authHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App), Secrets: secrets}}

	linked := insertSSOUser(t, h, "sso@example.com", idp.srv.URL, "idp-user")
	unlinked := insertSSOUser(t, h, "plain@example.com", "", "")

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	var uid string
	authed := f.Group("/", func(c fiber.Ctx) error {
		lib.ContextSetUID(c, uuid.MustParse(uid))
		return c.Next()
	})
	f.Get("/oidc/callback", h.OIDCCallback)
	authed.Get("/oidc/reauth", h.OIDCReauth)
	authed.Post("/totp/enable", h.TOTPEnable)

	get := func(user models.User, path string) *http.Response {
		t.Helper()
		uid = user.ID
		resp, err := f.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		return resp
	}

	// An unlinked account cannot start the ceremony — its password is the
	// reauthentication it already has.
	if resp := get(unlinked, "/oidc/reauth"); resp.StatusCode != 422 {
		t.Fatalf("unlinked reauth = %d, want 422", resp.StatusCode)
	}

	// A linked account is redirected to the provider demanding fresh auth.
	resp := get(linked, "/oidc/reauth")
	if resp.StatusCode != 302 {
		t.Fatalf("reauth redirect = %d, want 302", resp.StatusCode)
	}
	authURL, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse auth url: %v", err)
	}
	if got := authURL.Query().Get("prompt"); got != "login" {
		t.Fatalf("prompt = %q, want login", got)
	}
	state := authURL.Query().Get("state")
	if state == "" {
		t.Fatal("auth url carried no state")
	}
	// The IdP echoes the ceremony's nonce in its id_token — teach the fake
	// which one this run generated.
	st, ok := h.oidcStates.peek(state)
	if !ok {
		t.Fatal("no stored state for the reauth redirect")
	}
	idp.nonce = st.nonce

	// The callback verifies the returned identity is the linked pair and
	// redirects the dashboard-ward with the ticket — which also proves no
	// session was opened.
	resp, err = f.Test(httptest.NewRequest("GET", "/oidc/callback?state="+state+"&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback: %v", err)
	}
	loc, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse redirect: %v", err)
	}
	ticket := loc.Query().Get("sso_reauth")
	if resp.StatusCode != 302 || ticket == "" {
		t.Fatalf("callback = %d %q, want 302 with sso_reauth", resp.StatusCode, loc.String())
	}
	if rows, err := h.app.Repos.Refresh.ListActive(t.Context(), linked.ID); err != nil || len(rows) != 0 {
		t.Fatalf("reauth opened sessions = %d %v, want 0", len(rows), err)
	}

	// The ticket reauthenticates one action for the account it was minted for.
	secret, err := totp.NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	uid = linked.ID
	req := httptest.NewRequest("POST", "/totp/enable", strings.NewReader(
		`{"password":"","secret":"`+secret+`","code":"`+totp.Code(secret, time.Now())+`","reauth_ticket":"`+ticket+`"}`))
	req.Header.Set("Content-Type", "application/json")
	enResp, err := f.Test(req)
	if err != nil {
		t.Fatalf("POST /totp/enable: %v", err)
	}
	if enResp.StatusCode != 200 {
		t.Fatalf("totp enable with ticket = %d, want 200", enResp.StatusCode)
	}

	// A ceremony whose returned identity is not the linked pair mints
	// nothing: this account is bound to "linked-sub" but the provider
	// asserted its own "idp-user".
	other := insertSSOUser(t, h, "other@example.com", idp.srv.URL, "linked-sub")
	otherState := "st-mismatch"
	h.oidcStates.put(otherState, oidcState{nonce: idp.nonce, verifier: oauth2.GenerateVerifier(), reauthUID: other.ID}, oidcStateTTL)
	mresp, err := f.Test(httptest.NewRequest("GET", "/oidc/callback?state="+otherState+"&code=whatever", nil))
	if err != nil {
		t.Fatalf("GET /oidc/callback (mismatch): %v", err)
	}
	mpage, err := io.ReadAll(mresp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if mresp.StatusCode != 200 || reauthTicketRe.Match(mpage) || !strings.Contains(string(mpage), "different identity") {
		t.Fatalf("mismatch page = %d %q, want the identity-mismatch error page", mresp.StatusCode, string(mpage))
	}
}

// reauthTicketRe spots the ticket parameter in a callback redirect's query.
var reauthTicketRe = regexp.MustCompile(`sso_reauth`)
