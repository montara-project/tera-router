package middlewares

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/migrator"
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
	guard := ipblock.New(repositories.New(db, &config.ConfigApp{}).IPBlocks)
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
