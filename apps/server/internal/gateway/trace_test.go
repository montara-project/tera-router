package gateway

import (
	"net/http"
	"testing"

	"tera-router/server/internal/consolelog"
	"tera-router/server/internal/core"
	"tera-router/server/internal/dtos"
)

// lastRequest returns the newest Console entry the gateway wrote.
func lastRequest(t *testing.T) dtos.ConsoleEntry {
	t.Helper()
	entries := consolelog.List()
	for i := len(entries) - 1; i >= 0; i-- {
		if entries[i].Request != nil {
			return entries[i]
		}
	}
	t.Fatal("no request entry in the console feed")
	return dtos.ConsoleEntry{}
}

func eventKinds(r *dtos.ConsoleRequest) []string {
	out := make([]string, 0, len(r.Events))
	for _, e := range r.Events {
		out = append(out, e.Kind)
	}
	return out
}

func TestConsoleTraceRejectedCompletedFailed(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"c1","object":"chat.completion","model":"m",
			"choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")
	missing := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"message":"model not found"}}`))
	})
	registerProvider(t, a, "gone", missing.server.URL, "sk-gone")
	consolelog.Clear()

	// No key: refused by auth before any upstream is tried.
	resp := do(t, app, http.MethodPost, "/v1/chat/completions", `{"model":"fake/m","messages":[]}`, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	e := lastRequest(t)
	if e.Level != dtos.LogLevelWarn || e.Request.Outcome != "rejected" || e.Request.Status != 401 ||
		e.Request.Reason != "missing API key" || e.Request.Endpoint != "POST /v1/chat/completions" ||
		e.Request.RequestID == "" || e.Request.IP == "" {
		t.Errorf("rejected entry = %+v / %+v", e, *e.Request)
	}

	// Non-chat routes are traced too: a rejected model list.
	do(t, app, http.MethodGet, "/v1/models", "", nil)
	if e := lastRequest(t); e.Request.Endpoint != "GET /v1/models" || e.Request.Outcome != "rejected" {
		t.Errorf("models entry = %+v", *e.Request)
	}

	auth := map[string]string{"Authorization": "Bearer " + testKeyPlaintext}
	resp = do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/m","messages":[{"role":"user","content":"hi"}]}`, auth)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", resp.StatusCode, readBody(t, resp))
	}
	e = lastRequest(t)
	r := e.Request
	if e.Level != dtos.LogLevelInfo || r.Outcome != "completed" || r.ServedBy != "fake/m" || r.Tokens != 14 ||
		r.Model != "fake/m" || r.KeyName == "" || r.RequestID == "" || r.Mode != "standard" {
		t.Errorf("completed entry = %+v", *r)
	}
	if got := eventKinds(r); len(got) != 3 || got[0] != "received" || got[1] != "routed" || got[2] != "completed" {
		t.Errorf("events = %v, want received, routed, completed", got)
	}

	resp = do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"gone/m","messages":[{"role":"user","content":"hi"}]}`, auth)
	if resp.StatusCode < 400 {
		t.Fatalf("status = %d, want an error", resp.StatusCode)
	}
	e = lastRequest(t)
	r = e.Request
	if e.Level != dtos.LogLevelError || r.Outcome != "failed" || r.Status != resp.StatusCode || r.Reason == "" {
		t.Errorf("failed entry = %+v", *r)
	}
	if r.Provider != "gone" || r.UpstreamStatus != http.StatusNotFound || r.ErrorKind == "" {
		t.Errorf("upstream failure = provider %q status %d kind %q", r.Provider, r.UpstreamStatus, r.ErrorKind)
	}
	kinds := eventKinds(r)
	if len(kinds) < 3 || kinds[len(kinds)-2] != "attempt_failed" || kinds[len(kinds)-1] != "failed" {
		t.Errorf("events = %v, want ..., attempt_failed, failed", kinds)
	}
}

func TestTraceMethodsAreNilSafe(t *testing.T) {
	var tr *requestTrace
	tr.received("m", 1, false, 10)
	tr.routedTo("p/m", 2)
	tr.attemptFailed("p/m", &core.ProviderError{Kind: core.ErrUpstream, StatusCode: 502})
	tr.served("p/m", "acct", 5)
	tr.reject("boom")
	tr.deferFinish()
	tr.finish(200)
}
