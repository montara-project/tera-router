package oauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// testBuddyRealm serves a fake buddy realm over httptest and returns the realm
// pointing at it, with the CodeBuddy client identity.
func testBuddyRealm(t *testing.T, handler http.HandlerFunc) (BuddyRealm, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	realm := BuddyRealm{Host: srv.URL, Domain: "www.codebuddy.ai", Platform: "CLI", ClientVersion: codebuddyClientVersion, IDE: "CLI"}
	return realm, srv
}

// buddyJWT builds an unsigned session token whose payload carries the claims
// the realms issue (email, name).
func buddyJWT(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	enc := base64.RawURLEncoding
	return "eyJhbGciOiJub25lIn0." + enc.EncodeToString(payload) + ".sig"
}

// TestBuddyDeviceFlow pins the buddy sign-in: init returns the state plus the
// browser URL carrying the version hint, the poll reports pending on 11217 and
// ready with the JWT's email on code 0, and every request carries the realm's
// client identity.
func TestBuddyDeviceFlow(t *testing.T) {
	token := buddyJWT(t, map[string]any{"email": "me@example.com", "name": "Me"})
	var stateHeaders, pollHeaders http.Header
	realm, _ := testBuddyRealm(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/v2/plugin/auth/state"):
			stateHeaders = r.Header.Clone()
			if got := r.URL.Query().Get("platform"); got != "CLI" {
				t.Errorf("state platform = %q, want CLI", got)
			}
			_, _ = w.Write([]byte(`{"code":0,"data":{"state":"st-1","authUrl":"https://login.example/auth?x=1"}}`))
		case strings.HasPrefix(r.URL.Path, "/v2/plugin/auth/token"):
			pollHeaders = r.Header.Clone()
			switch r.URL.Query().Get("state") {
			case "st-1":
				_, _ = w.Write([]byte(`{"code":11217,"msg":"not authorized"}`))
			case "st-2":
				_, _ = w.Write([]byte(`{"code":0,"data":{"accessToken":"` + token + `","refreshToken":"rt-1"}}`))
			default:
				t.Errorf("unexpected poll state %q", r.URL.Query().Get("state"))
			}
		default:
			t.Errorf("unexpected path %q", r.URL.Path)
		}
	})

	ctx := context.Background()
	flow, err := ProviderConfig{Provider: "codebuddy", Buddy: &realm}.DeviceInit(ctx)
	if err != nil {
		t.Fatalf("init: %v", err)
	}
	if flow.FlowID != "st-1" {
		t.Errorf("flow id = %q, want st-1", flow.FlowID)
	}
	if got := flow.PollInterval(); got != buddyPollInterval {
		t.Errorf("poll interval = %s, want %s", got, buddyPollInterval)
	}
	if until := time.Until(flow.ExpiresAt); until < buddyFlowExpiry-time.Minute || until > buddyFlowExpiry {
		t.Errorf("flow expires in %s, want about %s", until, buddyFlowExpiry)
	}
	if !strings.Contains(flow.AuthorizeURL, "version="+codebuddyClientVersion) {
		t.Errorf("authorize url = %q, want the version hint", flow.AuthorizeURL)
	}

	cfg := ProviderConfig{Provider: "codebuddy", Buddy: &realm}
	status, tokens, err := cfg.DevicePoll(ctx, "st-1", "st-1")
	if err != nil || status != "pending" || tokens != nil {
		t.Fatalf("pending poll = %q, %v, %v", status, tokens, err)
	}
	status, tokens, err = cfg.DevicePoll(ctx, "st-2", "st-2")
	if err != nil || status != "ready" {
		t.Fatalf("ready poll = %q, %v", status, err)
	}
	if tokens.AccessToken != token || tokens.RefreshToken != "rt-1" || tokens.ExpiresIn != buddyAccessTokenTTL {
		t.Errorf("tokens = %+v, want the realm's grant and a 24h lifetime", tokens)
	}
	if tokens.Email != "me@example.com" || tokens.DisplayName != "Me" {
		t.Errorf("identity = %q/%q, want the JWT's email and name", tokens.Email, tokens.DisplayName)
	}
	// Both endpoints carry the realm's identity: the state request and the poll.
	for _, key := range []string{"X-Domain", "X-IDE-Type", "X-IDE-Version", "X-Product", "X-No-Authorization", "User-Agent"} {
		if stateHeaders.Get(key) == "" || pollHeaders.Get(key) == "" {
			t.Errorf("header %s missing (state=%q poll=%q)", key, stateHeaders.Get(key), pollHeaders.Get(key))
		}
	}
}

// TestBuddyRefresh pins the header-based refresh: POST with an empty JSON body,
// the refresh token in X-Refresh-Token, and the realm's identity headers.
func TestBuddyRefresh(t *testing.T) {
	var realm BuddyRealm
	realm, _ = testBuddyRealm(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v2/plugin/auth/token/refresh" {
			t.Errorf("refresh = %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("X-Refresh-Token"); got != "rt-old" {
			t.Errorf("X-Refresh-Token = %q, want rt-old", got)
		}
		if got := r.Header.Get("X-Auth-Refresh-Source"); got != "plugin" {
			t.Errorf("X-Auth-Refresh-Source = %q, want plugin", got)
		}
		if got := r.Header.Get("X-Domain"); got != realm.Domain {
			t.Errorf("X-Domain = %q, want %q", got, realm.Domain)
		}
		_, _ = w.Write([]byte(`{"code":0,"data":{"accessToken":"at-new","expiresIn":3600}}`))
	})

	tokens, err := ProviderConfig{Provider: "codebuddy", Buddy: &realm}.Refresh(context.Background(), "rt-old")
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if tokens.AccessToken != "at-new" || tokens.ExpiresIn != 3600 {
		t.Errorf("tokens = %+v, want the new grant", tokens)
	}
	// A realm that rotates no refresh token keeps the one it was given.
	if tokens.RefreshToken != "rt-old" {
		t.Errorf("refresh token = %q, want the stored one kept", tokens.RefreshToken)
	}
}

// TestBuddyRefreshRejected pins the failure path: a rejected refresh is a
// *RefreshError, so the manager can tell a dead token from a transient fault.
func TestBuddyRefreshRejected(t *testing.T) {
	realm, _ := testBuddyRealm(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid_grant","error_description":"refresh token expired"}`))
	})
	_, err := ProviderConfig{Provider: "codebuddy", Buddy: &realm}.Refresh(context.Background(), "rt-dead")
	if err == nil {
		t.Fatal("a rejected refresh returned no error")
	}
	if !IsPermanentRefresh(err) {
		t.Errorf("error %v is not permanent, want invalid_grant to be", err)
	}
}

// TestBuddyRealmIdentity pins the per-realm client fingerprint: WorkBuddy sends
// its own IDE identity, the CodeBuddy realms the CLI's, and X-Domain follows
// the host in every case.
func TestBuddyRealmIdentity(t *testing.T) {
	for _, slug := range []string{"workbuddy", "codebuddy", "codebuddy-cn"} {
		cfg, ok := ConfigFor(slug)
		if !ok || cfg.Buddy == nil {
			t.Fatalf("%s has no buddy config", slug)
		}
		if !cfg.DeviceFlow() {
			t.Errorf("%s is not a device-flow provider", slug)
		}
		headers := cfg.Buddy.authHeaders()
		if headers["X-Domain"] != cfg.Buddy.Domain {
			t.Errorf("%s X-Domain = %q, want %q", slug, headers["X-Domain"], cfg.Buddy.Domain)
		}
		wantIDE := "CLI"
		wantVersion := codebuddyClientVersion
		if slug == "workbuddy" {
			wantIDE = "WorkBuddy"
			wantVersion = workbuddyClientVersion
		}
		if headers["X-IDE-Type"] != wantIDE || headers["X-IDE-Name"] != wantIDE {
			t.Errorf("%s IDE identity = %q/%q, want %s", slug, headers["X-IDE-Type"], headers["X-IDE-Name"], wantIDE)
		}
		if headers["X-IDE-Version"] != wantVersion {
			t.Errorf("%s X-IDE-Version = %q, want %q", slug, headers["X-IDE-Version"], wantVersion)
		}
		if !strings.Contains(headers["User-Agent"], wantVersion) {
			t.Errorf("%s User-Agent = %q, want version %s", slug, headers["User-Agent"], wantVersion)
		}
	}
}

// TestBuddyInitRejectsBadState pins that an incomplete state reply fails the
// flow instead of handing the dashboard a URL it cannot use.
func TestBuddyInitRejectsBadState(t *testing.T) {
	realm, _ := testBuddyRealm(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":0,"data":{"state":"st-1"}}`))
	})
	cfg := ProviderConfig{Provider: "codebuddy", Buddy: &realm}
	if _, err := cfg.DeviceInit(context.Background()); err == nil {
		t.Fatal("a state reply without authUrl started a flow")
	}
}

// TestBuddyRefreshRejectionIsPermanent pins the refresh mapping: the realm
// reports {code,msg}, which the standard classifier reads as an empty code, so
// a 401 must still mark the token dead — otherwise EnsureFresh retries a
// refresh token that can never work again.
func TestBuddyRefreshRejectionIsPermanent(t *testing.T) {
	cases := []struct {
		name      string
		status    int
		body      string
		permanent bool
	}{
		{name: "unauthorized", status: http.StatusUnauthorized, body: `{"code":1001,"msg":"refresh token invalid"}`, permanent: true},
		{name: "ok status with an error code", status: http.StatusOK, body: `{"code":11140,"msg":"account restricted"}`, permanent: true},
		{name: "rate limited", status: http.StatusTooManyRequests, body: `{"code":1002,"msg":"rate limit exceeded"}`, permanent: false},
		{name: "server error", status: http.StatusBadGateway, body: `{"code":500,"msg":"upstream error"}`, permanent: false},
	}
	for _, tc := range cases {
		err := buddyRefreshError([]byte(tc.body), tc.status)
		if err.Permanent != tc.permanent {
			t.Errorf("%s: permanent = %v, want %v", tc.name, err.Permanent, tc.permanent)
		}
		if tc.status == http.StatusOK || tc.status == http.StatusUnauthorized {
			if !IsPermanentRefresh(err) {
				t.Errorf("%s: IsPermanentRefresh disagrees with the mapping", tc.name)
			}
		}
	}
}

// TestBuddyLifetimeReadsJWTExp pins that the expiry comes from the token when
// it carries one: assuming 24h for a 1h token would send an expired credential
// until the assumed window closed.
func TestBuddyLifetimeReadsJWTExp(t *testing.T) {
	exp := time.Now().Add(90 * time.Minute).Unix()
	token := buddyJWT(t, map[string]any{"exp": exp})
	got := buddyLifetime(token, 0)
	if got < 85*60 || got > 90*60 {
		t.Errorf("lifetime = %ds, want about 90 minutes from the exp claim", got)
	}
	// A token without exp falls back to the advertised value, then the default.
	if got := buddyLifetime("not-a-jwt", 3600); got != 3600 {
		t.Errorf("advertised lifetime ignored: %d", got)
	}
	if got := buddyLifetime("not-a-jwt", 0); got != buddyAccessTokenTTL {
		t.Errorf("default lifetime = %d, want %d", got, buddyAccessTokenTTL)
	}
}

// TestBuddyRefreshEnvelopeErrorIsPermanent pins that a 200 carrying an error
// code and no data is the realm refusing the grant, not a parse fault: read
// as transient, the dead refresh token would be retried forever.
func TestBuddyRefreshEnvelopeErrorIsPermanent(t *testing.T) {
	realm, _ := testBuddyRealm(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":11140,"msg":"account restricted"}`))
	})
	_, err := buddyRefresh(context.Background(), realm, "rt-flagged")
	var re *RefreshError
	if !errors.As(err, &re) {
		t.Fatalf("error %v is not a *RefreshError", err)
	}
	if !re.Permanent {
		t.Errorf("code 11140 refresh = %+v, want permanent", re)
	}
}

// TestBuddyLifetimeExpiredStaysExpired pins that a past exp is not replaced by
// the default lifetime: that would make a spent token look fresh for 24h.
func TestBuddyLifetimeExpiredStaysExpired(t *testing.T) {
	token := buddyJWT(t, map[string]any{"exp": time.Now().Add(-time.Hour).Unix()})
	if got := buddyLifetime(token, 3600); got != 1 {
		t.Errorf("expired token lifetime = %ds, want 1", got)
	}
}
