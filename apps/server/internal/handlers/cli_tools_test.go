package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// TestCLIToolApply pins the two key modes: "create" stores a new key named
// for the tool and writes its plaintext, "paste" only accepts an active key
// of this gateway. A refused request creates no key and writes no file.
func TestCLIToolApply(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", "")

	db, err := database.Open(filepath.Join(t.TempDir(), "cli_tools_test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatal(err)
	}
	repos := repositories.New(db, &cfg.App)
	h := &cliToolsHandler{app: &app.Application{Config: cfg, DB: db, Repos: repos, Secrets: secrets}}

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/cli-tools/:id", h.Show)
	f.Post("/cli-tools/:id/apply", h.Apply)
	call := func(method, path, body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}
	keyCount := func() int {
		_, total, err := repos.APIKeys.List(context.Background(), repositories.APIKeyFilter{}, 0, 100)
		if err != nil {
			t.Fatal(err)
		}
		return total
	}
	opencode := filepath.Join(home, ".config", "opencode", "opencode.json")

	status, out := call("GET", "/cli-tools/opencode?base_url=https://gw.example/&model=", "")
	data, _ := out["data"].(map[string]any)
	files, _ := data["files"].([]any)
	if status != 200 || data["model_required"] != true || len(files) != 1 ||
		!strings.Contains(files[0].(map[string]any)["content"].(string), "https://gw.example/v1") {
		t.Fatalf("show = %d %v", status, out)
	}
	if status, _ := call("GET", "/cli-tools/nope", ""); status != 404 {
		t.Fatalf("unknown tool = %d, want 404", status)
	}

	// Missing model, both key modes, or an unknown pasted key: refused.
	for _, body := range []string{
		`{"base_url":"https://gw.example","key_name":"OpenCode (CLI)"}`,
		`{"base_url":"https://gw.example","model":"m","key_name":"x","api_key":"sk_tr_x"}`,
		`{"base_url":"https://gw.example","model":"m","api_key":"sk_tr_unknown"}`,
	} {
		if status, out := call("POST", "/cli-tools/opencode/apply", body); status != 422 {
			t.Fatalf("%s = %d %v, want 422", body, status, out)
		}
	}
	if keyCount() != 0 {
		t.Fatal("a refused request created a key")
	}
	if _, err := os.Stat(opencode); !os.IsNotExist(err) {
		t.Fatal("a refused request wrote the config")
	}

	status, out = call("POST", "/cli-tools/opencode/apply", `{"base_url":"https://gw.example","model":"openai/gpt-x","key_name":"OpenCode (CLI)"}`)
	if status != 200 || keyCount() != 1 {
		t.Fatalf("create = %d %v", status, out)
	}
	written, _ := os.ReadFile(opencode)
	var doc struct {
		Provider map[string]struct {
			Options struct{ APIKey string } `json:"options"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(written, &doc); err != nil {
		t.Fatal(err)
	}
	stored, err := repos.APIKeys.GetByLookup(context.Background(), apikey.LookupHash(doc.Provider["tera-router"].Options.APIKey))
	if err != nil || stored.Name != "OpenCode (CLI)" {
		t.Fatalf("written key does not match the created key: %+v, %v", stored, err)
	}

	gen, _ := apikey.Generate()
	sealed, _ := secrets.SealString(gen.Plaintext, sealer.PurposeAPIKey)
	if err := repos.APIKeys.Insert(context.Background(), models.APIKey{
		ID: "pasted", Name: "mine", KeyHash: gen.Hash, LookupHash: gen.Lookup, Display: gen.Display, Secret: sealed,
	}); err != nil {
		t.Fatal(err)
	}
	status, out = call("POST", "/cli-tools/claude-code/apply", `{"base_url":"https://gw.example","api_key":"`+gen.Plaintext+`"}`)
	if status != 200 || keyCount() != 2 {
		t.Fatalf("paste = %d %v", status, out)
	}
	if settings, _ := os.ReadFile(filepath.Join(home, ".claude", "settings.json")); !strings.Contains(string(settings), gen.Plaintext) {
		t.Fatalf("claude settings miss the pasted key:\n%s", settings)
	}
}
