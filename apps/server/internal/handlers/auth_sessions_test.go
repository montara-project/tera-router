package handlers

import (
	"encoding/json"
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
)

// TestSessionsRevoke pins that revoking one session ends it at once (its
// access and refresh tokens) while the others keep working, and that a
// refresh keeps the session id.
func TestSessionsRevoke(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sessions_test.db"))
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
	f.Post("/sign-in", h.SignIn)
	f.Post("/refresh", h.Refresh)
	authed := f.Group("/", middlewares.RequireAuth(a))
	authed.Get("/sessions", h.Sessions)
	authed.Delete("/sessions/:id", h.RevokeSession)

	call := func(method, path, bearer, ua, body string) (int, any) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", ua)
		if bearer != "" {
			req.Header.Set("Authorization", "Bearer "+bearer)
		}
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("%s %s: %v", method, path, err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out["data"]
	}
	signIn := func(ua string) (access, refresh string) {
		t.Helper()
		status, data := call("POST", "/sign-in", "", ua, `{"email":"admin@tera.local","password":"test-password"}`)
		m, _ := data.(map[string]any)
		if status != 200 || m["access_token"] == nil {
			t.Fatalf("sign-in = %d %v", status, data)
		}
		return m["access_token"].(string), m["refresh_token"].(string)
	}
	list := func(bearer string) []map[string]any {
		t.Helper()
		status, data := call("GET", "/sessions", bearer, "", "")
		if status != 200 {
			t.Fatalf("sessions = %d %v", status, data)
		}
		var out []map[string]any
		for _, row := range data.([]any) {
			out = append(out, row.(map[string]any))
		}
		return out
	}

	laptop, _ := signIn("laptop-browser")
	phone, phoneRefresh := signIn("phone-browser")

	rows := list(laptop)
	if len(rows) != 2 {
		t.Fatalf("sessions = %d, want 2: %v", len(rows), rows)
	}
	var phoneID string
	for _, r := range rows {
		switch r["user_agent"] {
		case "laptop-browser":
			if r["current"] != true {
				t.Fatalf("laptop row not current: %v", r)
			}
		case "phone-browser":
			if r["current"] != false {
				t.Fatalf("phone row current from laptop: %v", r)
			}
			phoneID = r["id"].(string)
		}
	}
	if phoneID == "" {
		t.Fatalf("phone session missing: %v", rows)
	}

	// A refresh keeps the session id; the old refresh token is spent.
	status, data := call("POST", "/refresh", "", "", `{"refresh_token":"`+phoneRefresh+`"}`)
	m, _ := data.(map[string]any)
	if status != 200 || m["refresh_token"] == nil {
		t.Fatalf("refresh = %d %v", status, data)
	}
	if got := len(list(laptop)); got != 2 {
		t.Fatalf("sessions after refresh = %d, want 2", got)
	}
	if status, _ := call("POST", "/refresh", "", "", `{"refresh_token":"`+phoneRefresh+`"}`); status != 401 {
		t.Fatalf("reused refresh token = %d, want 401", status)
	}
	phoneRefresh = m["refresh_token"].(string)
	phoneRefreshed := m["access_token"].(string)

	if status, _ := call("DELETE", "/sessions/"+phoneID, laptop, "", ""); status != 200 {
		t.Fatalf("revoke = %d, want 200", status)
	}
	for name, tok := range map[string]string{"phone": phone, "phone refreshed": phoneRefreshed} {
		if status, _ := call("GET", "/sessions", tok, "", ""); status != 401 {
			t.Fatalf("%s access token after revoke = %d, want 401", name, status)
		}
	}
	if status, _ := call("POST", "/refresh", "", "", `{"refresh_token":"`+phoneRefresh+`"}`); status != 401 {
		t.Fatalf("phone refresh after revoke = %d, want 401", status)
	}
	if rows := list(laptop); len(rows) != 1 || rows[0]["current"] != true {
		t.Fatalf("sessions after revoke = %v, want only the laptop", rows)
	}
	if status, _ := call("DELETE", "/sessions/"+phoneID, laptop, "", ""); status != 404 {
		t.Fatalf("revoke twice = %d, want 404", status)
	}
}
