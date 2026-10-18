package middlewares

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/token"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/gofiber/fiber/v3"
)

const adminID = "00000000-0000-0000-0000-0000000000ff"

// TestRequireAuthRefusesRevokedSessions pins that a validly signed access
// token stops working once its sessions are revoked or its account disabled,
// without waiting for the token to expire.
func TestRequireAuthRefusesRevokedSessions(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "auth_mw_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	seeders.RoleSeeder{DB: db}.Seed()
	seeders.AdminUserSeeder{DB: db, Dev: true}.Seed()

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	a := &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}

	f := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	f.Get("/me", RequireAuth(a), func(c fiber.Ctx) error { return c.SendString("ok") })

	tokenAt := func(at time.Time) string {
		tok, _, err := token.SignAccess(cfg.App.Secret, adminID, "admin@tera.local", "admin", at, time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	status := func(tok string) int {
		t.Helper()
		req := httptest.NewRequest("GET", "/me", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}

	old := tokenAt(time.Now().Add(-time.Minute))
	if got := status(old); got != fiber.StatusOK {
		t.Fatalf("live token = %d, want 200", got)
	}

	if err := a.Repos.Users.RevokeSessions(context.Background(), adminID); err != nil {
		t.Fatal(err)
	}
	if got := status(old); got != fiber.StatusUnauthorized {
		t.Fatalf("token issued before revocation = %d, want 401", got)
	}
	// Signing in again right after a revocation must work, while a token from
	// the same second but before the revocation must not.
	if got := status(tokenAt(time.Now())); got != fiber.StatusOK {
		t.Fatalf("token issued after revocation = %d, want 200", got)
	}
	justBefore := tokenAt(time.Now().Add(-5 * time.Millisecond))
	if err := a.Repos.Users.RevokeSessions(context.Background(), adminID); err != nil {
		t.Fatal(err)
	}
	if got := status(justBefore); got != fiber.StatusUnauthorized {
		t.Fatalf("token issued 5ms before revocation = %d, want 401", got)
	}

	if _, err := db.Exec(`UPDATE users SET is_blocked = true WHERE id = $1`, adminID); err != nil {
		t.Fatal(err)
	}
	if got := status(tokenAt(time.Now())); got != fiber.StatusUnauthorized {
		t.Fatalf("blocked account = %d, want 401", got)
	}
	if got := status(tokenAt(time.Now()) + "x"); got != fiber.StatusUnauthorized {
		t.Fatalf("bad signature = %d, want 401", got)
	}
}
