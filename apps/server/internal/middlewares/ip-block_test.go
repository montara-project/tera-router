package middlewares

import (
	"context"
	"io"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// TestIPBlockAutoBlocksFailedSignIns drives the middleware the way the server
// wires it: failed sign-ins from one address end in 403 for every path.
func TestIPBlockAutoBlocksFailedSignIns(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "ipblock_mw_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repos := repositories.New(db, &config.ConfigApp{})
	guard := ipblock.New(repos.IPBlocks, repos.Settings)
	if err := guard.Reload(context.Background()); err != nil {
		t.Fatal(err)
	}

	app := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	app.Use(IPBlock(guard, nil))
	app.Post(signInPath, func(c fiber.Ctx) error { return apperr.ErrUnauthorized })
	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("ok") })

	status := func(method, path string) int {
		t.Helper()
		resp, err := app.Test(httptest.NewRequest(method, path, nil))
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}

	for i := 0; i < ipblock.FailLimit; i++ {
		if got := status("POST", signInPath); got != fiber.StatusUnauthorized {
			t.Fatalf("attempt %d = %d, want 401", i+1, got)
		}
	}
	if got := status("GET", "/health"); got != fiber.StatusForbidden {
		t.Fatalf("after %d failures /health = %d, want 403", ipblock.FailLimit, got)
	}
}

// TestIPBlockRestrictedAccess: during a restricted period only allowlisted
// addresses get through, and /health stays open to everyone. app.Test
// requests come from 0.0.0.0.
func TestIPBlockRestrictedAccess(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "restricted_mw_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repos := repositories.New(db, &config.ConfigApp{})
	guard := ipblock.New(repos.IPBlocks, repos.Settings)
	ctx := context.Background()
	allow := func(cidr string) {
		t.Helper()
		if err := repos.Settings.SetRestrictedAccess(ctx, models.RestrictedAccess{Enabled: true, AllowedIPs: []string{cidr}}); err != nil {
			t.Fatal(err)
		}
		if err := guard.Reload(ctx); err != nil {
			t.Fatal(err)
		}
	}

	app := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	app.Use(IPBlock(guard, nil))
	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("ok") })
	app.Get("/v1/keys", func(c fiber.Ctx) error { return c.SendString("ok") })

	do := func(path string) (int, string) {
		t.Helper()
		resp, err := app.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(body)
	}

	allow("0.0.0.0")
	if got, _ := do("/v1/keys"); got != fiber.StatusOK {
		t.Fatalf("allowlisted /v1/keys = %d, want 200", got)
	}
	allow("198.51.100.0/24")
	if got, body := do("/v1/keys"); got != fiber.StatusForbidden || !strings.Contains(body, "forbidden") {
		t.Fatalf("unlisted /v1/keys = %d %s, want 403 forbidden", got, body)
	}
	if got, _ := do("/health"); got != fiber.StatusOK {
		t.Fatalf("unlisted /health = %d, want 200", got)
	}
}
