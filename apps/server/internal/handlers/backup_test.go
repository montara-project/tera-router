package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

// backupHarness is one install: a migrated database file, a sealer derived
// from its own APP_SECRET, and a Fiber app exposing the backup routes.
type backupHarness struct {
	app   *app.Application
	fiber *fiber.App
}

func newBackupHarness(t *testing.T, appSecret string) backupHarness {
	t.Helper()
	path := filepath.Join(t.TempDir(), "terarouter.db")
	db, err := database.Open(path)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	secrets, err := sealer.FromSecret(appSecret)
	if err != nil {
		t.Fatalf("sealer: %v", err)
	}
	a := &app.Application{
		Config:  config.Config{Database: config.ConfigDatabase{Path: path}},
		DB:      db,
		Repos:   repositories.New(db, &config.ConfigApp{}),
		Secrets: secrets,
	}

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler, BodyLimit: 32 * 1024 * 1024})
	b := &backupHandler{app: a}
	li := &legacyImportHandler{app: a}
	f.Post("/backup/config/export", b.ConfigExport)
	f.Post("/backup/config/import", b.ConfigImport)
	f.Get("/backup/database/download", b.DatabaseDownload)
	f.Post("/backup/database/restore", b.DatabaseRestore)
	f.Post("/import/:source", li.Import)
	return backupHarness{app: a, fiber: f}
}

func (h backupHarness) do(t *testing.T, req *http.Request) (int, []byte) {
	t.Helper()
	resp, err := h.fiber.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("%s %s: %v", req.Method, req.URL.Path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, body
}

func (h backupHarness) postJSON(t *testing.T, path string, body any) (int, []byte) {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	return h.do(t, req)
}

// seedAccount inserts an API-key account sealed under the harness secret.
func (h backupHarness) seedAccount(t *testing.T, provider, key string) models.Account {
	t.Helper()
	acc := models.Account{ID: "acc-" + provider, Provider: provider, Label: provider, AuthKind: models.AuthAPIKey, Metadata: "{}", Priority: 100}
	if err := sealCredential(h.app, &acc, accountInput{APIKey: key}); err != nil {
		t.Fatalf("seal: %v", err)
	}
	if err := h.app.Repos.Accounts.Insert(context.Background(), acc); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	return acc
}

func (h backupHarness) seedChain(t *testing.T, name string) {
	t.Helper()
	chain := models.Chain{ID: "chain-" + name, Name: name, Strategy: "priority", Enabled: true, Steps: []models.ChainStep{
		{ID: "step-1-" + name, Position: 1, Provider: "openai", Model: "gpt-4o"},
		{ID: "step-2-" + name, Position: 2, Provider: "anthropic", Model: "claude-sonnet-4"},
	}}
	if err := h.app.Repos.Chains.Insert(context.Background(), chain); err != nil {
		t.Fatalf("insert chain: %v", err)
	}
}

func openAccountKey(t *testing.T, h backupHarness, id string) string {
	t.Helper()
	acc, err := h.app.Repos.Accounts.Get(context.Background(), id)
	if err != nil {
		t.Fatalf("get account %s: %v", id, err)
	}
	key, err := h.app.Secrets.OpenString(acc.Secret)
	if err != nil {
		t.Fatalf("open account secret: %v", err)
	}
	return key
}

// A portable backup moves credentials between installs with different
// APP_SECRETs; the passphrase gates it, and a non-portable backup is refused
// by a foreign install instead of restoring undecryptable credentials.
func TestConfigBackupPortableAcrossInstalls(t *testing.T) {
	src := newBackupHarness(t, "source-secret")
	src.seedAccount(t, "openai", "sk-live-source-key-123456")
	src.seedChain(t, "coding")

	status, portable := src.postJSON(t, "/backup/config/export", map[string]string{"passphrase": "correct horse"})
	if status != http.StatusOK {
		t.Fatalf("portable export status = %d: %s", status, portable)
	}
	if bytes.Contains(portable, []byte("sk-live-source-key-123456")) {
		t.Fatal("portable export leaked the plaintext credential")
	}
	status, sealedOnly := src.postJSON(t, "/backup/config/export", map[string]string{})
	if status != http.StatusOK {
		t.Fatalf("plain export status = %d: %s", status, sealedOnly)
	}

	dst := newBackupHarness(t, "destination-secret")
	dst.seedChain(t, "stale")

	status, body := dst.postJSON(t, "/backup/config/import", map[string]any{"passphrase": "wrong", "backup": json.RawMessage(portable)})
	if status != http.StatusBadRequest {
		t.Fatalf("wrong passphrase status = %d, want 400: %s", status, body)
	}
	status, body = dst.postJSON(t, "/backup/config/import", map[string]any{"backup": json.RawMessage(sealedOnly)})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("foreign non-portable import status = %d, want 422: %s", status, body)
	}

	status, body = dst.postJSON(t, "/backup/config/import", map[string]any{"passphrase": "correct horse", "backup": json.RawMessage(portable)})
	if status != http.StatusOK {
		t.Fatalf("portable import status = %d: %s", status, body)
	}
	if got := openAccountKey(t, dst, "acc-openai"); got != "sk-live-source-key-123456" {
		t.Errorf("restored account key = %q, want the source plaintext", got)
	}
	chains, err := dst.app.Repos.Chains.List(context.Background())
	if err != nil {
		t.Fatalf("list chains: %v", err)
	}
	if len(chains) != 1 || chains[0].Name != "coding" || len(chains[0].Steps) != 2 {
		t.Fatalf("chains after import = %+v, want only the backup's 'coding' chain with 2 steps", chains)
	}
	var res struct {
		Data struct {
			SafetyCopy string `json:"safety_copy"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &res)
	if _, err := os.Stat(res.Data.SafetyCopy); err != nil {
		t.Errorf("safety copy %q missing: %v", res.Data.SafetyCopy, err)
	}

	// Same install, no passphrase: the sealed blobs open as-is.
	status, body = src.postJSON(t, "/backup/config/import", map[string]any{"backup": json.RawMessage(sealedOnly)})
	if status != http.StatusOK {
		t.Fatalf("same-install import status = %d: %s", status, body)
	}
	if got := openAccountKey(t, src, "acc-openai"); got != "sk-live-source-key-123456" {
		t.Errorf("same-install restored key = %q", got)
	}
}

// The downloaded snapshot restores over a changed live database, and junk
// uploads are rejected before anything is touched.
func TestDatabaseDownloadRestoreRoundTrip(t *testing.T) {
	h := newBackupHarness(t, "secret")
	h.seedAccount(t, "openai", "sk-snapshot-key-123456")

	status, snapshot := h.do(t, httptest.NewRequest(http.MethodGet, "/backup/database/download", nil))
	if status != http.StatusOK || !bytes.HasPrefix(snapshot, []byte("SQLite format 3\x00")) {
		t.Fatalf("download status = %d, body is not a SQLite file", status)
	}

	if err := h.app.Repos.Accounts.Delete(context.Background(), "acc-openai"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	status, body := h.do(t, multipartUpload(t, "/backup/database/restore", "junk.db", []byte("not a database")))
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("junk restore status = %d, want 422: %s", status, body)
	}

	status, body = h.do(t, multipartUpload(t, "/backup/database/restore", "snapshot.db", snapshot))
	if status != http.StatusOK {
		t.Fatalf("restore status = %d: %s", status, body)
	}
	if got := openAccountKey(t, h, "acc-openai"); got != "sk-snapshot-key-123456" {
		t.Errorf("restored key = %q", got)
	}
}

func multipartUpload(t *testing.T, path, filename string, content []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(content)
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, path, &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

const nineRouterBackup = `{
  "providerConnections": [
    {"id": "c1", "provider": "openai", "authType": "apikey", "name": "OpenAI main", "apiKey": "sk-openai-imported-0001", "priority": 2, "isActive": true},
    {"id": "c2", "provider": "openai-compatible-abc", "authType": "apikey", "name": "My vLLM", "apiKey": "vllm-key-000000001", "providerSpecificData": {"proxyPoolId": "pool-1"}},
    {"id": "c3", "provider": "claude", "authType": "oauth", "email": "dev@example.com", "accessToken": "at-claude", "refreshToken": "rt-claude", "expiresAt": "2030-01-01T00:00:00Z"},
    {"id": "c4", "provider": "kiro", "authType": "oauth", "accessToken": "kiro-token"},
    {"id": "c5", "provider": "deepseek", "authType": "apikey", "apiKey": "sk-deepseek-000000001", "isActive": false}
  ],
  "providerNodes": [
    {"id": "openai-compatible-abc", "type": "openai-compatible", "name": "My vLLM", "prefix": "vllm", "apiType": "chat", "baseUrl": "https://vllm.example.com/v1/chat/completions"}
  ],
  "proxyPools": [{"id": "pool-1", "name": "Office", "proxyUrl": "http://proxy.example:3128", "type": "http", "isActive": true}],
  "apiKeys": [{"id": "k1", "key": "sk-9router-client-key-xyz", "name": "Laptop", "isActive": true}],
  "combos": [{"id": "cb1", "name": "smart", "models": ["cc/claude-sonnet-4", "vllm/qwen3-coder", "kr/claude-haiku", "deepseek/deepseek-chat"]}],
  "modelAliases": {"fast": "openai/gpt-4o-mini", "local": "kr/whatever"}
}`

// A 9router backup lands as working rows (keys re-hashed, nodes as custom
// providers, combos as chains), unmappable rows are reported, and re-running
// the import creates nothing new.
func TestImport9RouterBackup(t *testing.T) {
	h := newBackupHarness(t, "secret")
	ctx := context.Background()

	req := httptest.NewRequest(http.MethodPost, "/import/9router", bytes.NewBufferString(nineRouterBackup))
	req.Header.Set("Content-Type", "application/json")
	status, body := h.do(t, req)
	if status != http.StatusOK {
		t.Fatalf("import status = %d: %s", status, body)
	}
	var res struct {
		Data legacyImportResult `json:"data"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"custom_providers": 2, "proxy_pools": 1, "accounts": 4, "api_keys": 1, "chains": 1, "aliases": 1}
	for k, v := range want {
		if res.Data.Created[k] != v {
			t.Errorf("created[%s] = %d, want %d (skipped: %+v)", k, res.Data.Created[k], v, res.Data.Skipped)
		}
	}

	vllm, err := h.app.Repos.Providers.GetBySlug(ctx, "vllm")
	if err != nil || vllm.BaseURL != "https://vllm.example.com/v1" || vllm.APIKind != "openai" {
		t.Errorf("node provider = %+v (%v), want slug vllm with the per-request path stripped", vllm, err)
	}
	accounts, err := h.app.Repos.Accounts.ListByProvider(ctx, "vllm")
	if err != nil || len(accounts) != 1 || accounts[0].ProxyPoolID == nil {
		t.Fatalf("vllm accounts = %+v (%v), want one account linked to the imported pool", accounts, err)
	}
	claude, err := h.app.Repos.Accounts.ListByProvider(ctx, "anthropic")
	if err != nil || len(claude) != 1 || claude[0].AuthKind != models.AuthOAuth || claude[0].Token.Empty() || claude[0].Refresh.Empty() {
		t.Fatalf("claude → anthropic oauth account = %+v (%v)", claude, err)
	}
	deepseek, _ := h.app.Repos.Accounts.ListByProvider(ctx, "deepseek")
	if len(deepseek) != 1 || !deepseek[0].Disabled {
		t.Errorf("deepseek account = %+v, want one disabled account", deepseek)
	}

	key, err := h.app.Repos.APIKeys.GetByLookup(ctx, apikey.LookupHash("sk-9router-client-key-xyz"))
	if err != nil {
		t.Fatalf("imported key lookup: %v", err)
	}
	if ok, _ := apikey.Verify("sk-9router-client-key-xyz", key.KeyHash); !ok {
		t.Error("the original 9router key string does not verify against the imported hash")
	}

	chain, err := h.app.Repos.Chains.GetByName(ctx, "smart")
	if err != nil {
		t.Fatalf("chain: %v", err)
	}
	gotSteps := []string{}
	for _, s := range chain.Steps {
		gotSteps = append(gotSteps, s.Provider+"/"+s.Model)
	}
	wantSteps := []string{"anthropic/claude-sonnet-4", "vllm/qwen3-coder", "deepseek/deepseek-chat"}
	if len(gotSteps) != len(wantSteps) {
		t.Fatalf("chain steps = %v, want %v", gotSteps, wantSteps)
	}
	for i := range wantSteps {
		if gotSteps[i] != wantSteps[i] {
			t.Errorf("chain step %d = %s, want %s", i, gotSteps[i], wantSteps[i])
		}
	}
	if _, err := h.app.Repos.Aliases.GetByName(ctx, "local"); err == nil {
		t.Error("alias pointing only at an unsupported provider must be skipped")
	}

	req = httptest.NewRequest(http.MethodPost, "/import/9router", bytes.NewBufferString(nineRouterBackup))
	req.Header.Set("Content-Type", "application/json")
	status, body = h.do(t, req)
	if status != http.StatusOK {
		t.Fatalf("re-import status = %d: %s", status, body)
	}
	_ = json.Unmarshal(body, &res)
	for k, v := range res.Data.Created {
		if v != 0 {
			t.Errorf("re-import created %d %s, want 0", v, k)
		}
	}
}

// OmniRoute redacts credentials: accounts arrive as disabled stubs flagged
// for reconnect and API keys are not imported.
func TestImportOmniRouteBackup(t *testing.T) {
	h := newBackupHarness(t, "secret")
	req := httptest.NewRequest(http.MethodPost, "/import/omniroute", bytes.NewBufferString(nineRouterBackup))
	req.Header.Set("Content-Type", "application/json")
	status, body := h.do(t, req)
	if status != http.StatusOK {
		t.Fatalf("import status = %d: %s", status, body)
	}
	accounts, err := h.app.Repos.Accounts.ListByProvider(context.Background(), "openai")
	if err != nil || len(accounts) != 1 {
		t.Fatalf("openai accounts = %+v (%v)", accounts, err)
	}
	if a := accounts[0]; !a.Disabled || !a.NeedsReconnect || !a.Secret.Empty() {
		t.Errorf("omniroute account = %+v, want a disabled credential-less stub needing reconnect", a)
	}
	if _, err := h.app.Repos.APIKeys.GetByLookup(context.Background(), apikey.LookupHash("sk-9router-client-key-xyz")); err == nil {
		t.Error("OmniRoute API keys must not be imported")
	}
}
