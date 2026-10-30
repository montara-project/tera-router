package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"net/netip"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/lib/totp"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// TestRotateRequiresReauth pins that rotating a key needs the password, then
// the TOTP code once enabled, and that the old plaintext stops resolving while
// the new one is sealed for reveal.
func TestRotateRequiresReauth(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "rotate_test.db"))
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
	repos := repositories.New(db, &cfg.App)
	a := &app.Application{Config: cfg, DB: db, Repos: repos, Secrets: secrets, IPBlocks: ipblock.New(repos.IPBlocks, repos.Settings)}

	gen, err := apikey.Generate()
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := secrets.SealString(gen.Plaintext)
	if err != nil {
		t.Fatal(err)
	}
	keyID := uuid.NewString()
	if err := repos.APIKeys.Insert(context.Background(), models.APIKey{
		ID: keyID, Name: "k", KeyHash: gen.Hash, LookupHash: gen.Lookup, Display: gen.Display, Secret: sealed,
	}); err != nil {
		t.Fatal(err)
	}

	admin := uuid.MustParse("00000000-0000-0000-0000-0000000000ff")
	clientIP := netip.MustParseAddr("203.0.113.7")
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	authed := f.Group("/", func(c fiber.Ctx) error {
		lib.ContextSetUID(c, admin)
		lib.ContextSetClientIP(c, clientIP)
		return c.Next()
	})
	auth := &authHandler{app: a}
	authed.Post("/totp/setup", auth.TOTPSetup)
	authed.Post("/totp/enable", auth.TOTPEnable)
	authed.Post("/keys/:id/rotate", (&keysHandler{app: a}).Rotate)

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
	rotate := func(pw, otp string) (int, map[string]any) {
		return call("/keys/"+keyID+"/rotate", `{"password":"`+pw+`","otp":"`+otp+`"}`)
	}

	if status, _ := call("/keys/"+keyID+"/rotate", `{}`); status == 200 {
		t.Fatalf("rotate without password = 200")
	}
	if status, data := rotate("wrong", ""); status != 422 || data["full_key"] != nil {
		t.Fatalf("wrong password = %d %v, want 422", status, data)
	}

	_, setup := call("/totp/setup", `{}`)
	secret, _ := setup["secret"].(string)
	now := time.Now()
	prev, cur := totp.Code(secret, now.Add(-30*time.Second)), totp.Code(secret, now)
	if status, _ := call("/totp/enable", `{"secret":"`+secret+`","code":"`+prev+`"}`); status != 200 {
		t.Fatalf("enable = %d", status)
	}

	if status, data := rotate("pw", ""); status != 200 || data["totp_required"] != true || data["full_key"] != nil {
		t.Fatalf("rotate without code = %d %v, want totp_required", status, data)
	}
	if status, _ := rotate("pw", "000000"); status != 422 {
		t.Fatalf("wrong code = %d, want 422", status)
	}
	status, data := rotate("pw", cur)
	fresh, _ := data["full_key"].(string)
	if status != 200 || fresh == "" || fresh == gen.Plaintext {
		t.Fatalf("rotate with code = %d %v", status, data)
	}

	ctx := context.Background()
	if _, err := repos.APIKeys.GetByLookup(ctx, gen.Lookup); err == nil {
		t.Fatalf("old key still resolves after rotate")
	}
	got, err := repos.APIKeys.GetByLookup(ctx, apikey.LookupHash(fresh))
	if err != nil || got.ID != keyID {
		t.Fatalf("new key lookup = %v %v, want id %s", got.ID, err, keyID)
	}
	if ok, _ := apikey.Verify(fresh, got.KeyHash); !ok {
		t.Fatalf("new key does not verify against stored hash")
	}
	if opened, err := secrets.OpenString(got.Secret); err != nil || opened != fresh {
		t.Fatalf("sealed secret = %q %v, want new key", opened, err)
	}
}
