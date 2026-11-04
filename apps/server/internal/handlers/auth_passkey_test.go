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
	"tera-router/server/internal/lib"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/seeders"

	"github.com/descope/virtualwebauthn"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// TestPasskeyFlow registers a passkey with a virtual authenticator, signs in
// with it, and pins the refusals: wrong password, replayed ceremonies, an IP
// origin, and a deleted passkey.
func TestPasskeyFlow(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "passkey_test.db"))
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

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret", Name: "Tera Router"}}
	h := &passkeysHandler{app: &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}}

	const adminID = "00000000-0000-0000-0000-0000000000ff"
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/passkey/begin", h.SignInBegin)
	f.Post("/passkey/finish", h.SignInFinish)
	authed := f.Group("/", func(c fiber.Ctx) error { lib.ContextSetUID(c, uuid.MustParse(adminID)); return c.Next() })
	authed.Get("/passkeys", h.List)
	authed.Post("/passkeys/register/begin", h.RegisterBegin)
	authed.Post("/passkeys/register/finish", h.RegisterFinish)
	authed.Delete("/passkeys/:id", h.Delete)

	const origin = "http://localhost:5173"
	call := func(method, path, origin, body string) (int, map[string]any, any) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		resp, err := f.Test(req)
		if err != nil {
			t.Fatalf("%s %s: %v", method, path, err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		m, _ := out["data"].(map[string]any)
		return resp.StatusCode, m, out["data"]
	}
	options := func(data map[string]any) string {
		b, _ := json.Marshal(data["options"])
		return string(b)
	}
	finishBody := func(ceremonyID any, credential string) string {
		b, _ := json.Marshal(map[string]any{"ceremony_id": ceremonyID, "name": "Laptop", "credential": json.RawMessage(credential)})
		return string(b)
	}

	rp := virtualwebauthn.RelyingParty{Name: "Tera Router", ID: "localhost", Origin: origin}
	authenticator := virtualwebauthn.NewAuthenticatorWithOptions(virtualwebauthn.AuthenticatorOptions{UserHandle: []byte(adminID)})
	cred := virtualwebauthn.NewCredential(virtualwebauthn.KeyTypeEC2)

	if status, _, _ := call("POST", "/passkeys/register/begin", origin, `{"password":"wrong"}`); status != 422 {
		t.Fatalf("register with wrong password = %d, want 422", status)
	}
	if status, _, _ := call("POST", "/passkeys/register/begin", "http://127.0.0.1:8080", `{"password":"pw"}`); status != 400 {
		t.Fatalf("register on an IP origin = %d, want 400", status)
	}

	status, begin, _ := call("POST", "/passkeys/register/begin", origin, `{"password":"pw"}`)
	if status != 200 {
		t.Fatalf("register begin = %d %v", status, begin)
	}
	attOpts, err := virtualwebauthn.ParseAttestationOptions(options(begin))
	if err != nil {
		t.Fatal(err)
	}
	attestation := virtualwebauthn.CreateAttestationResponse(rp, authenticator, cred, *attOpts)
	if status, data, _ := call("POST", "/passkeys/register/finish", origin, finishBody(begin["ceremony_id"], attestation)); status != 200 || data["rp_id"] != "localhost" {
		t.Fatalf("register finish = %d %v", status, data)
	}
	authenticator.AddCredential(cred)
	if status, _, _ := call("POST", "/passkeys/register/finish", origin, finishBody(begin["ceremony_id"], attestation)); status != 422 {
		t.Fatalf("replayed registration = %d, want 422", status)
	}

	_, _, raw := call("GET", "/passkeys", origin, "")
	list, _ := raw.([]any)
	if len(list) != 1 {
		t.Fatalf("passkeys = %v, want 1", raw)
	}
	passkeyID := list[0].(map[string]any)["id"].(string)

	signIn := func() (int, string) {
		t.Helper()
		status, begin, _ := call("POST", "/passkey/begin", origin, `{}`)
		if status != 200 {
			t.Fatalf("sign-in begin = %d %v", status, begin)
		}
		asOpts, err := virtualwebauthn.ParseAssertionOptions(options(begin))
		if err != nil {
			t.Fatal(err)
		}
		body := finishBody(begin["ceremony_id"], virtualwebauthn.CreateAssertionResponse(rp, authenticator, cred, *asOpts))
		status, data, _ := call("POST", "/passkey/finish", origin, body)
		if status == 200 && data["access_token"] == nil {
			t.Fatalf("sign-in without tokens: %v", data)
		}
		if replay, _, _ := call("POST", "/passkey/finish", origin, body); replay != 401 {
			t.Fatalf("replayed sign-in = %d, want 401", replay)
		}
		return status, body
	}

	if status, _ := signIn(); status != 200 {
		t.Fatalf("passkey sign-in = %d, want 200", status)
	}
	// The sign count moved past zero and was stored, so a second sign-in
	// still verifies.
	if status, _ := signIn(); status != 200 {
		t.Fatalf("second passkey sign-in = %d, want 200", status)
	}

	// One client cannot hold more than maxCeremoniesPerIP open sign-ins.
	// The flow above finished every ceremony it began, so the store is empty.
	for i := range maxCeremoniesPerIP {
		if status, _, _ := call("POST", "/passkey/begin", origin, `{}`); status != 200 {
			t.Fatalf("begin #%d = %d, want 200", i+1, status)
		}
	}
	if status, _, _ := call("POST", "/passkey/begin", origin, `{}`); status != 429 {
		t.Fatalf("begin over the per-client cap = %d, want 429", status)
	}
	h.ceremonies = ceremonyStore{}

	if status, _, _ := call("DELETE", "/passkeys/"+passkeyID, origin, ""); status != 200 {
		t.Fatalf("delete = %d, want 200", status)
	}
	if status, _ := signIn(); status != 401 {
		t.Fatalf("sign-in with a deleted passkey = %d, want 401", status)
	}
}
