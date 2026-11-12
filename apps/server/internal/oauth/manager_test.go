package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// newTestManager builds a Manager on a migrated temporary database, mirroring
// how the repositories tests fake persistence.
func newTestManager(t *testing.T) (*Manager, *repositories.Repositories, *sealer.Sealer) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "manager_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repos := repositories.New(db, &config.ConfigApp{})
	s, err := sealer.FromSecret("manager-test-secret")
	if err != nil {
		t.Fatalf("sealer: %v", err)
	}
	return NewManager(repos, s, nil), repos, s
}

// registerTestConfig installs a provider OAuth config (usually pointing at an
// httptest server) and restores the previous entry on cleanup.
func registerTestConfig(t *testing.T, cfg ProviderConfig) {
	t.Helper()
	prev, existed := configs[cfg.Provider]
	configs[cfg.Provider] = cfg
	t.Cleanup(func() {
		if existed {
			configs[cfg.Provider] = prev
		} else {
			delete(configs, cfg.Provider)
		}
	})
}

// insertExpiringOAuthAccount seeds an OAuth account whose access token
// already expired, with refreshTok sealed into the refresh column. An empty
// refreshTok leaves the refresh column empty.
func insertExpiringOAuthAccount(t *testing.T, repos *repositories.Repositories, s *sealer.Sealer, id, provider, refreshTok string) models.Account {
	t.Helper()
	expires := time.Now().Add(-time.Hour)
	acc := models.Account{
		ID: id, Provider: provider, Label: id,
		AuthKind:       models.AuthOAuth,
		Metadata:       "{}",
		TokenExpiresAt: &expires,
	}
	access, err := s.SealString("stale-access-"+id, sealer.PurposeAccountToken)
	if err != nil {
		t.Fatalf("seal token: %v", err)
	}
	acc.Token = access
	if refreshTok != "" {
		refresh, err := s.SealString(refreshTok, sealer.PurposeAccountRefresh)
		if err != nil {
			t.Fatalf("seal refresh: %v", err)
		}
		acc.Refresh = refresh
	}
	if err := repos.Accounts.Insert(context.Background(), acc); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	return acc
}

// countingTokenServer counts and records the refresh_token form field of
// every request, then answers with the given status/body after delay.
type countingTokenServer struct {
	*httptest.Server
	calls        atomic.Int32
	sentRefresh  atomic.Value // string
	sentGrantTyp atomic.Value // string
}

func newCountingTokenServer(t *testing.T, status int, body string, delay time.Duration) *countingTokenServer {
	t.Helper()
	cs := &countingTokenServer{}
	cs.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cs.calls.Add(1)
		_ = r.ParseForm()
		cs.sentRefresh.Store(r.Form.Get("refresh_token"))
		cs.sentGrantTyp.Store(r.Form.Get("grant_type"))
		if delay > 0 {
			time.Sleep(delay)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(cs.Server.Close)
	return cs
}

// TestEnsureFreshSkipsUnrefreshable covers every path that must NOT hit the
// token endpoint: non-OAuth accounts, OAuth accounts without an expiry, OAuth
// accounts still inside their validity window, and providers with no OAuth
// refresh config.
func TestEnsureFreshSkipsUnrefreshable(t *testing.T) {
	m, _, _ := newTestManager(t)
	srv := newCountingTokenServer(t, http.StatusInternalServerError, `{}`, 0)
	registerTestConfig(t, ProviderConfig{Provider: "testoauth", ClientID: "cid", TokenURL: srv.URL})

	expired := time.Now().Add(-time.Hour)
	fresh := time.Now().Add(10 * time.Minute) // beyond refreshSkew

	cases := []struct {
		name string
		acc  models.Account
	}{
		{"api key account, expired", models.Account{ID: "k1", Provider: "testoauth", AuthKind: models.AuthAPIKey, TokenExpiresAt: &expired}},
		{"oauth account, no expiry", models.Account{ID: "o1", Provider: "testoauth", AuthKind: models.AuthOAuth}},
		{"oauth account, still fresh", models.Account{ID: "o2", Provider: "testoauth", AuthKind: models.AuthOAuth, TokenExpiresAt: &fresh}},
		{"provider without oauth config", models.Account{ID: "o3", Provider: "no-such-provider", AuthKind: models.AuthOAuth, TokenExpiresAt: &expired}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := m.EnsureFresh(context.Background(), tc.acc)
			if err != nil {
				t.Fatalf("EnsureFresh: %v", err)
			}
			if got.ID != tc.acc.ID {
				t.Errorf("account id = %q, want %q", got.ID, tc.acc.ID)
			}
		})
	}
	if n := srv.calls.Load(); n != 0 {
		t.Errorf("token endpoint hit %d times, want 0", n)
	}
}

// TestEnsureFreshWithoutRefreshToken: an OAuth account with an empty refresh
// column fails fast — before any HTTP — so a mis-provisioned row never burns
// a provider request.
func TestEnsureFreshWithoutRefreshToken(t *testing.T) {
	m, repos, s := newTestManager(t)
	srv := newCountingTokenServer(t, http.StatusOK, `{"access_token":"x"}`, 0)
	registerTestConfig(t, ProviderConfig{Provider: "testoauth", ClientID: "cid", TokenURL: srv.URL})

	acc := insertExpiringOAuthAccount(t, repos, s, "acc-nr", "testoauth", "")
	if _, err := m.EnsureFresh(context.Background(), acc); err == nil || !strings.Contains(err.Error(), "no refresh token") {
		t.Fatalf("EnsureFresh error = %v, want no-refresh-token failure", err)
	}
	if n := srv.calls.Load(); n != 0 {
		t.Errorf("token endpoint hit %d times, want 0", n)
	}
}

// TestEnsureFreshConcurrentRefresh proves the per-account singleflight:
// concurrent callers for the same account share one provider refresh because
// OAuth refresh tokens are single-use — a second exchange with the same
// token would get the account killed with invalid_grant.
func TestEnsureFreshConcurrentRefresh(t *testing.T) {
	m, repos, s := newTestManager(t)
	ctx := context.Background()

	// The 150ms delay keeps the first exchange in flight while the second
	// caller queues on the account mutex. The assertion is deterministic
	// either way: whoever waits re-reads the row, sees the rotated expiry
	// beyond refreshSkew, and skips the endpoint — calls must stay 1.
	srv := newCountingTokenServer(t, http.StatusOK,
		`{"access_token":"at-new","refresh_token":"rt-2","expires_in":3600}`, 150*time.Millisecond)
	registerTestConfig(t, ProviderConfig{Provider: "testoauth", ClientID: "cid", TokenURL: srv.URL})

	acc := insertExpiringOAuthAccount(t, repos, s, "acc-1", "testoauth", "rt-1")

	var wg sync.WaitGroup
	outs := make([]models.Account, 2)
	errs := make([]error, 2)
	call := func(i int) {
		defer wg.Done()
		outs[i], errs[i] = m.EnsureFresh(ctx, acc)
	}
	wg.Add(2)
	go call(0)
	time.Sleep(50 * time.Millisecond) // let the first caller take the lock and enter HTTP
	go call(1)
	wg.Wait()

	if errs[0] != nil || errs[1] != nil {
		t.Fatalf("EnsureFresh errors: %v / %v", errs[0], errs[1])
	}
	if n := srv.calls.Load(); n != 1 {
		t.Fatalf("token endpoint calls = %d, want 1 (single-use refresh token spent twice otherwise)", n)
	}
	if got := srv.sentRefresh.Load().(string); got != "rt-1" {
		t.Errorf("refresh_token sent = %q, want rt-1", got)
	}
	if got := srv.sentGrantTyp.Load().(string); got != "refresh_token" {
		t.Errorf("grant_type sent = %q, want refresh_token", got)
	}

	// Both callers end up with the rotated access token and a fresh expiry.
	for i, out := range outs {
		opened, err := s.OpenString(out.Token, sealer.PurposeAccountToken)
		if err != nil || opened != "at-new" {
			t.Errorf("caller %d access token = %q (%v), want at-new", i, opened, err)
		}
		if out.TokenExpiresAt == nil || time.Until(*out.TokenExpiresAt) <= refreshSkew {
			t.Errorf("caller %d expiry = %v, want beyond refreshSkew", i, out.TokenExpiresAt)
		}
	}

	// The rotated refresh token was persisted, sealed.
	row, err := repos.Accounts.Get(ctx, "acc-1")
	if err != nil {
		t.Fatalf("get account: %v", err)
	}
	if opened, err := s.OpenString(row.Refresh, sealer.PurposeAccountRefresh); err != nil || opened != "rt-2" {
		t.Errorf("persisted refresh = %q (%v), want rt-2", opened, err)
	}
	if row.NeedsReconnect {
		t.Error("needs_reconnect set after a successful refresh")
	}
}

// TestEnsureFreshPermanentFailureFlagged: invalid_grant means the refresh
// token is dead — the account must be flagged needs_reconnect so the
// dashboard stops dispatching through it.
func TestEnsureFreshPermanentFailureFlagged(t *testing.T) {
	m, repos, s := newTestManager(t)
	ctx := context.Background()

	srv := newCountingTokenServer(t, http.StatusBadRequest,
		`{"error":"invalid_grant","error_description":"refresh token revoked"}`, 0)
	registerTestConfig(t, ProviderConfig{Provider: "testoauth", ClientID: "cid", TokenURL: srv.URL})

	acc := insertExpiringOAuthAccount(t, repos, s, "acc-dead", "testoauth", "rt-dead")

	if _, err := m.EnsureFresh(ctx, acc); err == nil || !strings.Contains(err.Error(), "refresh failed") {
		t.Fatalf("EnsureFresh error = %v, want refresh failure", err)
	}
	if n := srv.calls.Load(); n != 1 {
		t.Errorf("token endpoint calls = %d, want 1", n)
	}

	row, err := repos.Accounts.Get(ctx, "acc-dead")
	if err != nil {
		t.Fatalf("get account: %v", err)
	}
	if !row.NeedsReconnect {
		t.Error("needs_reconnect = false after invalid_grant, want true")
	}
}

// TestEnsureFreshTransientFailureNotFlagged: a 5xx/rate-limit answer is
// retryable and must not mark the account for reconnection.
func TestEnsureFreshTransientFailureNotFlagged(t *testing.T) {
	m, repos, s := newTestManager(t)
	ctx := context.Background()

	srv := newCountingTokenServer(t, http.StatusServiceUnavailable,
		`{"error":"temporarily_unavailable"}`, 0)
	registerTestConfig(t, ProviderConfig{Provider: "testoauth", ClientID: "cid", TokenURL: srv.URL})

	acc := insertExpiringOAuthAccount(t, repos, s, "acc-busy", "testoauth", "rt-busy")

	if _, err := m.EnsureFresh(ctx, acc); err == nil || !strings.Contains(err.Error(), "refresh failed") {
		t.Fatalf("EnsureFresh error = %v, want refresh failure", err)
	}

	row, err := repos.Accounts.Get(ctx, "acc-busy")
	if err != nil {
		t.Fatalf("get account: %v", err)
	}
	if row.NeedsReconnect {
		t.Error("needs_reconnect = true after a transient 503, want false")
	}
}
