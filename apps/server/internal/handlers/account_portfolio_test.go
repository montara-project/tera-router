package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

func (h backupHarness) withAccountPortfolio() backupHarness {
	ah := &accountsHandler{app: h.app}
	h.fiber.Post("/providers/:id/accounts/export", ah.Export)
	h.fiber.Post("/providers/:id/accounts/import", ah.Import)
	return h
}

// TestAccountPortfolioRoundTrip pins the per-provider accounts backup: the
// export needs the password and a passphrase, carries no plaintext, holds only
// that provider's accounts, and imports on an install with another APP_SECRET.
// A second import of the same file adds nothing.
func TestAccountPortfolioRoundTrip(t *testing.T) {
	ctx := context.Background()
	src := newBackupHarness(t, "source-secret").withAccountPortfolio()
	const apiKey, token, refresh = "sk-cline-key-0123456789", "oauth-access-token-abc", "oauth-refresh-token-xyz"

	keyed := models.Account{ID: "acc-key", Provider: "cline", Label: "work", AuthKind: models.AuthAPIKey, Priority: 7, Disabled: true,
		Metadata: `{"base_url":"https://proxy.example/api/v1","headers":{"X-Team":"a"}}`}
	if err := sealCredential(src.app, &keyed, accountInput{APIKey: apiKey}); err != nil {
		t.Fatal(err)
	}
	signedIn := models.Account{ID: "acc-oauth", Provider: "cline", Label: "me@example.com", AuthKind: models.AuthOAuth, Priority: 100,
		Metadata: `{"email":"me@example.com"}`}
	if err := sealCredential(src.app, &signedIn, accountInput{Token: token, Refresh: refresh}); err != nil {
		t.Fatal(err)
	}
	for _, a := range []models.Account{keyed, signedIn} {
		if err := src.app.Repos.Accounts.Insert(ctx, a); err != nil {
			t.Fatal(err)
		}
	}
	src.seedAccount(t, "openai", "sk-other-provider-key-0001")

	export := func(body map[string]string) (int, []byte) {
		t.Helper()
		return src.postJSON(t, "/providers/cline/accounts/export", body)
	}
	if status, _ := export(map[string]string{"passphrase": "pass phrase"}); status == http.StatusOK {
		t.Fatal("export without the password succeeded")
	}
	if status, _ := export(map[string]string{"passphrase": "pass phrase", "password": "wrong"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("export with a wrong password = %d, want 422", status)
	}
	if status, _ := export(map[string]string{"password": backupAdminPassword}); status == http.StatusOK {
		t.Fatal("export without a passphrase succeeded")
	}
	status, file := export(map[string]string{"passphrase": "pass phrase", "password": backupAdminPassword})
	if status != http.StatusOK {
		t.Fatalf("export = %d: %s", status, file)
	}
	for _, secret := range []string{apiKey, token, refresh, "sk-other-provider-key-0001"} {
		if bytes.Contains(file, []byte(secret)) {
			t.Fatalf("the export carries plaintext %q", secret)
		}
	}
	var doc accountsBackup
	if err := json.Unmarshal(file, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.Format != accountsBackupFormat || doc.Provider != "cline" || len(doc.Accounts) != 2 {
		t.Fatalf("export = %s / %s / %d accounts, want the 2 cline accounts", doc.Format, doc.Provider, len(doc.Accounts))
	}
	if status, _ := src.postJSON(t, "/providers/nvidia/accounts/export", map[string]string{"passphrase": "p", "password": backupAdminPassword}); status != http.StatusNotFound {
		t.Fatalf("export of a provider without accounts = %d, want 404", status)
	}

	dst := newBackupHarness(t, "destination-secret").withAccountPortfolio()
	importAs := func(provider, passphrase string, doc accountsBackup) (int, int, int) {
		t.Helper()
		status, raw := dst.postJSON(t, "/providers/"+provider+"/accounts/import", map[string]any{"passphrase": passphrase, "backup": doc})
		var res struct {
			Data struct {
				Imported int                  `json:"imported"`
				Skipped  []accountsImportSkip `json:"skipped"`
			} `json:"data"`
		}
		_ = json.Unmarshal(raw, &res)
		return status, res.Data.Imported, len(res.Data.Skipped)
	}
	count := func() int {
		t.Helper()
		list, _, err := dst.app.Repos.Accounts.List(ctx, repositories.AccountFilter{}, 0, 100)
		if err != nil {
			t.Fatal(err)
		}
		return len(list)
	}

	if status, _, _ := importAs("cline", "not the passphrase", doc); status != http.StatusBadRequest || count() != 0 {
		t.Fatalf("wrong passphrase = %d with %d accounts stored, want 400 and none", status, count())
	}
	if status, _, _ := importAs("clinepass", "pass phrase", doc); status != http.StatusUnprocessableEntity || count() != 0 {
		t.Fatalf("import into another provider = %d with %d accounts stored, want 422 and none", status, count())
	}
	if status, _, _ := importAs("no-such-provider", "pass phrase", doc); status != http.StatusNotFound {
		t.Fatalf("import into an unknown provider = %d, want 404", status)
	}
	damaged := doc
	damaged.Accounts = append([]backupAccount{}, doc.Accounts...)
	damaged.Accounts[1].Token = doc.Accounts[1].Token[:len(doc.Accounts[1].Token)-8] + "AAAAAAA="
	if status, _, _ := importAs("cline", "pass phrase", damaged); status != http.StatusUnprocessableEntity || count() != 0 {
		t.Fatalf("damaged file = %d with %d accounts stored, want 422 and none", status, count())
	}

	if status, imported, skipped := importAs("cline", "pass phrase", doc); status != http.StatusOK || imported != 2 || skipped != 0 {
		t.Fatalf("import = %d, %d imported, %d skipped, want 200/2/0", status, imported, skipped)
	}
	if status, imported, skipped := importAs("cline", "pass phrase", doc); status != http.StatusOK || imported != 0 || skipped != 2 {
		t.Fatalf("second import = %d, %d imported, %d skipped, want 200/0/2", status, imported, skipped)
	}

	list, err := dst.app.Repos.Accounts.ListByProvider(ctx, "cline")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("destination holds %d cline accounts, want 2", len(list))
	}
	open := func(s sealer.Sealed, purpose string) string {
		t.Helper()
		plain, err := dst.app.Secrets.OpenString(s, purpose)
		if err != nil {
			t.Fatalf("open %s on the destination: %v", purpose, err)
		}
		return plain
	}
	for _, a := range list {
		switch a.Label {
		case "work":
			if open(a.Secret, sealer.PurposeAccountSecret) != apiKey || a.KeyFingerprint != keyed.KeyFingerprint {
				t.Errorf("api key account did not survive the move")
			}
			if a.Priority != 7 || !a.Disabled || a.AuthKind != models.AuthAPIKey {
				t.Errorf("api key account = priority %d disabled %v kind %s", a.Priority, a.Disabled, a.AuthKind)
			}
			if !strings.Contains(a.Metadata, `"X-Team":"a"`) || metadataBaseURL(a.Metadata) != "https://proxy.example/api/v1" {
				t.Errorf("metadata = %s, want base_url and headers kept", a.Metadata)
			}
		case "me@example.com":
			if open(a.Token, sealer.PurposeAccountToken) != token || open(a.Refresh, sealer.PurposeAccountRefresh) != refresh {
				t.Errorf("oauth tokens did not survive the move")
			}
		default:
			t.Errorf("unexpected account %q", a.Label)
		}
		if a.ID == keyed.ID || a.ID == signedIn.ID {
			t.Errorf("account %q kept its source id", a.Label)
		}
	}
	// A key repeated inside one file is stored once (on a fresh install: a key
	// hash is unique across providers, so the destination already holds it),
	// and an oversized file is refused whole.
	fresh := newBackupHarness(t, "third-secret").withAccountPortfolio()
	repeated := doc
	twin := doc.Accounts[0]
	if twin.Secret == "" {
		twin = doc.Accounts[1]
	}
	repeated.Accounts = []backupAccount{twin, twin}
	status, raw := fresh.postJSON(t, "/providers/cline/accounts/import", map[string]any{"passphrase": "pass phrase", "backup": repeated})
	var twice struct {
		Data struct {
			Imported int                  `json:"imported"`
			Skipped  []accountsImportSkip `json:"skipped"`
		} `json:"data"`
	}
	_ = json.Unmarshal(raw, &twice)
	if status != http.StatusOK || twice.Data.Imported != 1 || len(twice.Data.Skipped) != 1 {
		t.Fatalf("file with a repeated key = %d, %d imported, %d skipped, want 200/1/1", status, twice.Data.Imported, len(twice.Data.Skipped))
	}
	oversized := doc
	oversized.Accounts = make([]backupAccount, maxBulkKeys+1)
	before := count()
	if status, _, _ := importAs("cline", "pass phrase", oversized); status != http.StatusUnprocessableEntity || count() != before {
		t.Fatalf("oversized file = %d with %d new accounts, want 422 and none", status, count()-before)
	}

	// The connect seeded the provider row, as a manual add does.
	if _, err := dst.app.Repos.Providers.GetBySlug(ctx, "cline"); err != nil {
		t.Errorf("cline provider row not seeded: %v", err)
	}
}

// An account whose metadata holds a non-string value (a headers object) must
// still be recognised by its email, or a re-import duplicates it.
func TestAccountMetaValueToleratesObjects(t *testing.T) {
	raw := `{"email":"me@example.com","headers":{"X-Team":"a"}}`
	if got := accountMetaValue(raw, "email"); got != "me@example.com" {
		t.Errorf("email = %q, want me@example.com", got)
	}
	if got := accountMetaValue(raw, "headers"); got != "" {
		t.Errorf("a non-string value = %q, want empty", got)
	}
}

// idrouterPortfolioFixture builds an IDrouter "account-portfolio" file: its
// secrets are sealed per secret, each with its own salt, exactly as IDrouter
// writes them.
func idrouterPortfolioFixture(t *testing.T, provider, passphrase string, accounts []struct {
	label    string
	authKind models.AuthKind
	metadata string
	secret   string
	token    string
	refresh  string
}) map[string]any {
	t.Helper()
	seal := func(plain string) map[string]string {
		t.Helper()
		ps, err := sealer.NewPortable(passphrase)
		if err != nil {
			t.Fatalf("portable: %v", err)
		}
		ct, err := ps.Seal(plain)
		if err != nil {
			t.Fatalf("seal: %v", err)
		}
		return map[string]string{"salt": ps.Salt(), "ciphertext": ct}
	}
	out := make([]map[string]any, 0, len(accounts))
	for _, a := range accounts {
		secret := map[string]any{}
		if a.secret != "" {
			secret["secret"] = seal(a.secret)
		}
		if a.token != "" {
			secret["token"] = seal(a.token)
		}
		if a.refresh != "" {
			secret["refresh"] = seal(a.refresh)
		}
		if a.metadata == "" {
			a.metadata = "{}"
		}
		out = append(out, map[string]any{
			"provider":        provider,
			"label":           a.label,
			"auth_kind":       string(a.authKind),
			"priority":        100,
			"disabled":        false,
			"metadata":        a.metadata,
			"portable_secret": secret,
		})
	}
	return map[string]any{
		"version":     1,
		"kind":        "account-portfolio",
		"provider":    provider,
		"portable":    true,
		"exported_at": "2026-11-13T00:00:00Z",
		"accounts":    out,
	}
}

// TestAccountImportFromIDrouterFile pins the direct import of an IDrouter
// per-provider export: no conversion tool, a wrong passphrase is refused as a
// wrong passphrase, and a second import of the same file adds nothing.
func TestAccountImportFromIDrouterFile(t *testing.T) {
	ctx := context.Background()
	type idrouterFixtureAccount = struct {
		label    string
		authKind models.AuthKind
		metadata string
		secret   string
		token    string
		refresh  string
	}
	const apiKey, token, refresh = "sk-cline-key-0123456789", "cline-access-jwt", "cline-refresh-token"
	file := idrouterPortfolioFixture(t, "cline", "pass phrase", []idrouterFixtureAccount{
		{label: "key", authKind: models.AuthAPIKey, metadata: `{"base_url":"https://api.cline.bot/api/v1"}`, secret: apiKey},
		{label: "me@example.com", authKind: models.AuthOAuth, metadata: `{"email":"me@example.com"}`, token: token, refresh: refresh},
	})
	// IDrouter writes token_expires_at as RFC3339 text, not a JSON timestamp.
	file["accounts"].([]map[string]any)[1]["token_expires_at"] = "2026-12-01T00:00:00Z"

	dst := newBackupHarness(t, "idrouter-destination").withAccountPortfolio()
	importFile := func(passphrase string) (int, int, []byte) {
		t.Helper()
		status, raw := dst.postJSON(t, "/providers/cline/accounts/import", map[string]any{"passphrase": passphrase, "backup": file})
		var res struct {
			Data struct {
				Imported int                  `json:"imported"`
				Skipped  []accountsImportSkip `json:"skipped"`
			} `json:"data"`
		}
		_ = json.Unmarshal(raw, &res)
		return status, res.Data.Imported, raw
	}

	status, imported, raw := importFile("not the passphrase")
	if status != http.StatusBadRequest {
		t.Fatalf("wrong passphrase = %d (%s), want 400", status, raw)
	}
	if imported != 0 {
		t.Fatalf("wrong passphrase imported %d accounts, want none", imported)
	}

	status, imported, raw = importFile("pass phrase")
	if status != http.StatusOK || imported != 2 {
		t.Fatalf("import = %d, %d imported (%s), want 200/2", status, imported, raw)
	}
	status, imported, raw = importFile("pass phrase")
	if status != http.StatusOK || imported != 0 {
		t.Fatalf("second import = %d, %d imported (%s), want 200/0", status, imported, raw)
	}

	accounts, err := dst.app.Repos.Accounts.ListByProvider(ctx, "cline")
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) != 2 {
		t.Fatalf("stored %d accounts, want 2", len(accounts))
	}
	open := func(s sealer.Sealed, purpose string) string {
		t.Helper()
		plain, err := dst.app.Secrets.OpenString(s, purpose)
		if err != nil {
			t.Fatalf("open %s: %v", purpose, err)
		}
		return plain
	}
	for _, a := range accounts {
		switch a.Label {
		case "key":
			if open(a.Secret, sealer.PurposeAccountSecret) != apiKey || a.AuthKind != models.AuthAPIKey {
				t.Errorf("api key account did not survive the conversion")
			}
		case "me@example.com":
			if open(a.Token, sealer.PurposeAccountToken) != token || open(a.Refresh, sealer.PurposeAccountRefresh) != refresh {
				t.Errorf("oauth tokens did not survive the conversion")
			}
			if a.TokenExpiresAt == nil || !a.TokenExpiresAt.Equal(time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)) {
				t.Errorf("token_expires_at = %v, want 2026-12-01T00:00:00Z", a.TokenExpiresAt)
			}
		default:
			t.Errorf("unexpected account %q", a.Label)
		}
	}
}
