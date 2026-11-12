package handlers

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/requestid"
)

// TestAuditTrailRecordsRequest pins that AuditTrail writes queued entries
// with the status the client received: a refused sign-in is stored as failed
// with its 401, and a successful one carries the new session id, the route,
// the user agent and the request id.
func TestAuditTrailRecordsRequest(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "audit_test.db"))
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
	a := &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}
	h := &authHandler{app: a}

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Use(requestid.New())
	v1 := f.Group("/v1", AuditTrail(a))
	v1.Post("/auth/sign-in", h.SignIn)

	signIn := func(password string) int {
		t.Helper()
		req := httptest.NewRequest("POST", "/v1/auth/sign-in",
			strings.NewReader(`{"email":"admin@tera.local","password":"`+password+`"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "audit-test/1.0")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}
	if s := signIn("wrong"); s != 401 {
		t.Fatalf("bad sign-in = %d, want 401", s)
	}
	if s := signIn("test-password"); s != 200 {
		t.Fatalf("sign-in = %d, want 200", s)
	}

	rows, total, err := a.Repos.Audit.List(context.Background(), repositories.AuditFilter{Limit: 10})
	if err != nil || total != 2 {
		t.Fatalf("audit rows = %d, err %v; want 2", total, err)
	}
	ok, failed := rows[0], rows[1]
	if failed.Outcome != "failed" || failed.Status != 401 || failed.Target != "admin@tera.local" || failed.Actor != "" {
		t.Fatalf("failed sign-in entry = %+v", failed)
	}
	if ok.Outcome != "success" || ok.Status != 200 || ok.SessionID == "" || ok.Method != "POST" ||
		ok.Route != "/v1/auth/sign-in" || ok.UserAgent != "audit-test/1.0" || ok.RequestID == "" || ok.ClientIP == "" {
		t.Fatalf("sign-in entry = %+v", ok)
	}
	if v, err := a.Repos.Audit.Verify(context.Background()); err != nil || !v.OK || v.Checked != 2 {
		t.Fatalf("verify = %+v, err %v", v, err)
	}
}
