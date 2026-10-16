package gateway

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"tera-router/server/internal/app"
)

// addWebAccount connects a catalog web provider to a fake upstream through the
// account's base_url override.
func addWebAccount(t *testing.T, a *app.Application, provider, baseURL, key string, priority int) {
	t.Helper()
	sealed, err := a.Secrets.SealString(key)
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	exec(t, a, `INSERT INTO accounts (id, provider, label, auth_kind, secret_wrapped_dek, secret_ciphertext, metadata, priority)
		VALUES (?, ?, 'acct', 'api_key', ?, ?, ?, ?)`,
		"acct-"+provider, provider, sealed.WrappedDEK, sealed.Ciphertext, `{"base_url":"`+baseURL+`"}`, priority)
}

// A failing search provider falls back to the next one, whose hits come back
// normalized; fetch rejects a non-http URL before any upstream is called.
func TestWebSearchFallbackAndFetch(t *testing.T) {
	fiberApp, a := newGatewayApp(t)
	auth := map[string]string{"Authorization": "Bearer " + testKeyPlaintext}

	exa := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	tavily := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"results":[{"title":"Go","url":"https://go.dev","content":"The Go language"},{"title":"x","url":"https://x","content":"y"}]}`))
	})
	addWebAccount(t, a, "exa", exa.server.URL, "exa-key", 100)
	addWebAccount(t, a, "tavily", tavily.server.URL, "tvly-key", 100)

	resp := do(t, fiberApp, http.MethodPost, "/v1/search", `{"query":"golang","max_results":1}`, auth)
	body := readBody(t, resp)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, body %s", resp.StatusCode, body)
	}
	var got struct {
		Provider string
		Results  []struct{ Title, URL, Snippet string }
	}
	_ = json.Unmarshal([]byte(body), &got)
	if got.Provider != "tavily" || len(got.Results) != 1 || got.Results[0].URL != "https://go.dev" || got.Results[0].Snippet != "The Go language" {
		t.Fatalf("unexpected response %s", body)
	}
	if reqs := exa.captured(); len(reqs) == 0 || reqs[0].Headers.Get("x-api-key") != "exa-key" {
		t.Errorf("exa was not tried with its key: %+v", reqs)
	}
	if reqs := tavily.captured(); reqs[0].Path != "/search" || reqs[0].Headers.Get("Authorization") != "Bearer tvly-key" {
		t.Errorf("tavily request = %+v", reqs[0])
	}

	resp = do(t, fiberApp, http.MethodPost, "/v1/web/fetch", `{"url":"file:///etc/passwd"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusBadRequest || !strings.Contains(body, "http(s)") {
		t.Fatalf("fetch bad url: status %d body %s", resp.StatusCode, body)
	}

	resp = do(t, fiberApp, http.MethodPost, "/v1/web/fetch", `{"url":"https://go.dev","provider":"serper"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("serper fetch: status %d body %s", resp.StatusCode, body)
	}
}
