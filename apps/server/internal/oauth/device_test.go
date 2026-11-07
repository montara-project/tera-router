package oauth

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// testZcodeConfig returns the zcode config with its endpoints pointed at a
// test server that serves the device flow's three faces (init, poll, token).
func testZcodeConfig(t *testing.T, pollStatus string, pollToken *string) ProviderConfig {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/cli/init"):
			if r.Header.Get("Authorization") == "" || r.Method != http.MethodPost {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			io.WriteString(w, `{"code":0,"data":{"flow_id":"flow-1","authorize_url":"https://zcode.z.ai/oauth/authorize?flow=flow-1","poll_interval_sec":1}}`)
		case strings.Contains(r.URL.Path, "/cli/poll/"):
			if r.Header.Get("Authorization") == "" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			if pollToken != nil {
				*pollToken = r.Header.Get("Authorization")
			}
			io.WriteString(w, pollStatus)
		case strings.HasSuffix(r.URL.Path, "/oauth/token"):
			// ZCode's token endpoint wants JSON with the provider body field.
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["provider"] != "zai" || body["grant_type"] != "refresh_token" {
				w.WriteHeader(http.StatusBadRequest)
				io.WriteString(w, `{"code":1,"msg":"bad token request"}`)
				return
			}
			io.WriteString(w, `{"code":0,"data":{"token":{"access_token":"new-at","refresh_token":"new-rt"}}}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	cfg, _ := ConfigFor("zcode")
	cfg.DeviceInitURL = srv.URL + "/api/v1/oauth/cli/init"
	cfg.DevicePollURL = srv.URL + "/api/v1/oauth/cli/poll"
	cfg.TokenURL = srv.URL + "/api/v1/oauth/token"
	return cfg
}

func TestZcodeDeviceFlow(t *testing.T) {
	var gotAuth string
	cfg := testZcodeConfig(t, `{"code":0,"data":{"status":"ready","token":{"access_token":"at","refresh_token":"rt"},"user":{"email":"a@b.c"}}}`, &gotAuth)

	if !cfg.DeviceFlow() {
		t.Fatal("zcode config must be a device flow")
	}

	flow, err := cfg.DeviceInit(context.Background())
	if err != nil {
		t.Fatalf("DeviceInit: %v", err)
	}
	if flow.FlowID != "flow-1" || flow.AuthorizeURL == "" || flow.PollToken == "" {
		t.Fatalf("init flow = %+v", flow)
	}
	if flow.ExpiresAt.Before(time.Now().Add(4 * time.Minute)) {
		t.Errorf("flow expiry too soon: %v", flow.ExpiresAt)
	}

	status, tokens, err := cfg.DevicePoll(context.Background(), flow.FlowID, flow.PollToken)
	if err != nil {
		t.Fatalf("DevicePoll: %v", err)
	}
	if status != "ready" {
		t.Fatalf("status = %q, want ready", status)
	}
	if tokens.AccessToken != "at" || tokens.RefreshToken != "rt" {
		t.Errorf("tokens = %+v", tokens)
	}
	if tokens.Email != "a@b.c" {
		t.Errorf("email = %q", tokens.Email)
	}
	// The poll must carry the generated poll token as its bearer credential.
	if gotAuth != "Bearer "+flow.PollToken {
		t.Errorf("poll auth = %q, want the generated poll token", gotAuth)
	}

	// The refresh endpoint wraps the token object in data.token and wants the
	// provider body field.
	refreshed, err := cfg.Refresh(context.Background(), "old-rt")
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if refreshed.AccessToken != "new-at" || refreshed.RefreshToken != "new-rt" {
		t.Errorf("refreshed = %+v", refreshed)
	}
}

func TestZcodeDevicePollPending(t *testing.T) {
	cfg := testZcodeConfig(t, `{"code":0,"data":{"status":"authorizing"}}`, nil)
	status, tokens, err := cfg.DevicePoll(context.Background(), "flow-1", "tok")
	if err != nil || status != "pending" || tokens != nil {
		t.Fatalf("pending poll = (%q, %v, %v)", status, tokens, err)
	}
}

func TestZcodeDevicePollGoneIsExpired(t *testing.T) {
	cfg := testZcodeConfig(t, `gone`, nil)
	// A 404 (flow already expired server-side) reports expired, not an error.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	cfg.DevicePollURL = srv.URL + "/cli/poll"

	status, _, err := cfg.DevicePoll(context.Background(), "flow-1", "tok")
	if err != nil || status != "expired" {
		t.Fatalf("gone poll = (%q, %v)", status, err)
	}
}

// TestZcodeConfigEndpoints pins the wire contract of the upstream device flow.
func TestZcodeConfigEndpoints(t *testing.T) {
	cfg, ok := ConfigFor("zcode")
	if !ok {
		t.Fatal("no config for zcode")
	}
	for _, want := range []string{
		"https://zcode.z.ai/api/v1/oauth/cli/init",
		"https://zcode.z.ai/api/v1/oauth/cli/poll",
		"https://zcode.z.ai/api/v1/oauth/token",
	} {
		found := cfg.DeviceInitURL == want || cfg.DevicePollURL == want || cfg.TokenURL == want
		if !found {
			t.Errorf("endpoint %q missing from zcode config", want)
		}
	}
	if cfg.TokenBodyProvider != "zai" || !cfg.TokenResponseWrapped {
		t.Errorf("zcode token quirks = (%q, %v)", cfg.TokenBodyProvider, cfg.TokenResponseWrapped)
	}
}

// ZCode may answer data.token as the bare access token string, with the
// refresh token beside it in data.
func TestZcodeDevicePollStringToken(t *testing.T) {
	cfg := testZcodeConfig(t, `{"code":0,"data":{"status":"ready","token":"at","refresh_token":"rt","expires_in":3600,"user":{"email":"a@b.c"}}}`, nil)
	status, tokens, err := cfg.DevicePoll(context.Background(), "flow-1", "tok")
	if err != nil || status != "ready" {
		t.Fatalf("poll = (%q, %v)", status, err)
	}
	if tokens.AccessToken != "at" || tokens.RefreshToken != "rt" || tokens.ExpiresIn != 3600 || tokens.Email != "a@b.c" {
		t.Errorf("tokens = %+v", tokens)
	}
}

// An upstream outage or a transport blip keeps the sign-in waiting; the
// flow's expiry ends the retries, not one bad poll.
func TestZcodeDevicePollTransientIsPending(t *testing.T) {
	cfg := testZcodeConfig(t, `{}`, nil)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	cfg.DevicePollURL = srv.URL + "/cli/poll"
	if status, _, err := cfg.DevicePoll(context.Background(), "flow-1", "tok"); err != nil || status != "pending" {
		t.Fatalf("5xx poll = (%q, %v), want pending", status, err)
	}

	srv.Close()
	if status, _, err := cfg.DevicePoll(context.Background(), "flow-1", "tok"); err != nil || status != "pending" {
		t.Fatalf("unreachable poll = (%q, %v), want pending", status, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := cfg.DevicePoll(ctx, "flow-1", "tok"); err == nil {
		t.Fatal("cancelled poll must return the error")
	}
}
