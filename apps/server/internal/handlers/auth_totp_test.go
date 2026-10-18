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

// TestTOTPFlow walks enrollment, the two-step sign-in, replay rejection and
// disabling against a real database.
func TestTOTPFlow(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "totp_test.db"))
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
	f.Post("/sign-in", h.SignIn)
	authed := f.Group("/", func(c fiber.Ctx) error { lib.ContextSetUID(c, admin); return c.Next() })
	authed.Post("/totp/setup", h.TOTPSetup)
	authed.Post("/totp/enable", h.TOTPEnable)
	authed.Post("/totp/disable", h.TOTPDisable)

	call := func(path, body string) (int, map[string]any) {
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
	signIn := func(otp string) (int, map[string]any) {
		return call("/sign-in", `{"email":"admin@tera.local","password":"pw","otp":"`+otp+`"}`)
	}

	// Without TOTP a password alone signs in.
	if status, data := signIn(""); status != 200 || data["access_token"] == nil {
		t.Fatalf("plain sign-in = %d %v", status, data)
	}

	_, setup := call("/totp/setup", `{}`)
	secret, _ := setup["secret"].(string)
	if !strings.HasPrefix(setup["otpauth_url"].(string), "otpauth://totp/") {
		t.Fatalf("otpauth_url = %v", setup["otpauth_url"])
	}

	// Three consecutive steps inside the ±1 window, so each code is fresh.
	now := time.Now()
	prev, cur, next := totp.Code(secret, now.Add(-30*time.Second)), totp.Code(secret, now), totp.Code(secret, now.Add(30*time.Second))

	if status, _ := call("/totp/enable", `{"secret":"`+secret+`","code":"abcdef"}`); status != 401 {
		t.Fatalf("enable with a wrong code = %d, want 401", status)
	}
	if status, _ := call("/totp/enable", `{"secret":"`+secret+`","code":"`+prev+`"}`); status != 200 {
		t.Fatalf("enable = %d", status)
	}

	if status, data := signIn(""); status != 200 || data["totp_required"] != true || data["access_token"] != nil {
		t.Fatalf("sign-in without code = %d %v, want totp_required", status, data)
	}
	if status, _ := signIn(prev); status != 401 {
		t.Fatalf("replayed enrollment code = %d, want 401", status)
	}
	if status, data := signIn(cur); status != 200 || data["access_token"] == nil {
		t.Fatalf("sign-in with code = %d %v", status, data)
	}
	if status, _ := signIn(cur); status != 401 {
		t.Fatalf("replayed sign-in code = %d, want 401", status)
	}

	if status, _ := call("/totp/disable", `{"code":"`+next+`"}`); status != 200 {
		t.Fatalf("disable = %d", status)
	}
	if status, data := signIn(""); status != 200 || data["access_token"] == nil {
		t.Fatalf("sign-in after disable = %d %v", status, data)
	}
}
