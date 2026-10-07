package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/dtos"
)

func mustRaw(t *testing.T, v string) json.RawMessage {
	t.Helper()
	return json.RawMessage(v)
}

func TestUsdPerTokenToMicros(t *testing.T) {
	cases := []struct {
		raw  string
		want int64
		ok   bool
	}{
		{`"0.0000025"`, 2_500_000, true}, // $2.50 / M tokens (string)
		{`0.00001`, 10_000_000, true},    // $10 / M tokens (number)
		{`"0"`, 0, true},                 // genuinely free
		{`"0.000000125"`, 125_000, true}, // cache-read scale
		{`"free"`, 0, false},             // non-numeric string
		{`"-1"`, 0, false},               // negative is not a price
		{`null`, 0, false},               // absent value
		{`"1e-6"`, 1_000_000, true},      // scientific notation
	}
	for _, tc := range cases {
		got, ok := usdPerTokenToMicros(mustRaw(t, tc.raw))
		if ok != tc.ok {
			t.Errorf("usdPerTokenToMicros(%s) ok = %v, want %v", tc.raw, ok, tc.ok)
			continue
		}
		if ok && got != tc.want {
			t.Errorf("usdPerTokenToMicros(%s) = %d, want %d", tc.raw, got, tc.want)
		}
	}
}

// TestParseUpstreamPricing pins the OpenRouter pricing-object convention some
// OpenAI-compatible upstreams follow on /v1/models entries.
func TestParseUpstreamPricing(t *testing.T) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{
		"prompt": "0.0000025",
		"completion": "0.00001",
		"request": "0",
		"input_cache_read": "0.000000125",
		"input_cache_write": "0.00000125",
		"web_search": 0
	}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	p := parseUpstreamPricing(raw)
	if p == nil {
		t.Fatal("expected pricing to parse")
	}
	want := UpstreamPricing{
		InputMicros:      2_500_000,
		OutputMicros:     10_000_000,
		CacheReadMicros:  125_000,
		CacheWriteMicros: 1_250_000,
	}
	if *p != want {
		t.Errorf("pricing = %+v, want %+v", *p, want)
	}
}

func TestParseUpstreamPricingNil(t *testing.T) {
	if p := parseUpstreamPricing(nil); p != nil {
		t.Errorf("empty pricing = %+v, want nil", p)
	}

	// A pricing object without prompt/completion carries no usable rate for
	// this router's token-based cost model.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{"image": "0.001"}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if p := parseUpstreamPricing(raw); p != nil {
		t.Errorf("image-only pricing = %+v, want nil", p)
	}
}

func TestParseUpstreamPricingToleratesGarbage(t *testing.T) {
	// Non-numeric values must not poison the parse: usable fields survive.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{
		"prompt": "0.0000025",
		"completion": "free",
		"input_cache_read": null
	}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	p := parseUpstreamPricing(raw)
	if p == nil {
		t.Fatal("expected pricing to parse despite a non-numeric field")
	}
	if p.InputMicros != 2_500_000 {
		t.Errorf("input = %d, want 2500000", p.InputMicros)
	}
	if p.OutputMicros != 0 || p.CacheReadMicros != 0 {
		t.Errorf("unparseable fields must stay zero, got %+v", p)
	}
}

// The Ollama sync reads the native /api/tags surface (origin, not /v1) and
// maps the tags' names onto model ids.
func TestListOllamaModels(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		if r.Header.Get("Authorization") != "Bearer ork-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"models":[{"name":"llama3.2"},{"name":"gpt-oss:20b"},{"name":""}]}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	models, err := svc.ListOllamaModels(context.Background(), srv.URL+"/v1", "ork-key")
	if err != nil {
		t.Fatalf("ListOllamaModels: %v", err)
	}
	if gotPath != "/api/tags" {
		t.Errorf("path = %q, want /api/tags", gotPath)
	}
	if len(models) != 2 || models[0].ID != "gpt-oss:20b" || models[1].ID != "llama3.2" {
		t.Errorf("models = %+v", models)
	}
}

// The Cline sync unions /models with the recommended-models free list, dedups
// by id, prefixes the key with workos:, and fails only when both upstreams
// fail.
func TestListClineModels(t *testing.T) {
	var gotAuth, gotUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotUA = r.Header.Get("User-Agent")
		switch r.URL.Path {
		case "/api/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"anthropic/claude-sonnet-4.5"},{"id":"deepseek/deepseek-chat"}]}`))
		case "/api/v1/ai/cline/recommended-models":
			_, _ = w.Write([]byte(`{"free":[{"id":"deepseek/deepseek-chat"},{"id":"cline-free/mimo-v2.6-flash","name":"MiMo"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	models, err := svc.ListClineModels(context.Background(), srv.URL+"/api/v1", "raw-key")
	if err != nil {
		t.Fatalf("ListClineModels: %v", err)
	}
	if gotAuth != "Bearer workos:raw-key" {
		t.Errorf("auth = %q, want the workos-prefixed key", gotAuth)
	}
	if gotUA != "Cline/1.0.0" {
		t.Errorf("user-agent = %q", gotUA)
	}
	if len(models) != 3 {
		t.Fatalf("models = %+v, want the 3-id union", models)
	}
	if models[0].ID != "anthropic/claude-sonnet-4.5" || models[1].ID != "cline-free/mimo-v2.6-flash" || models[2].ID != "deepseek/deepseek-chat" {
		t.Errorf("union = %+v", models)
	}
}

func TestListClineModelsBothFail(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusBadGateway)
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	if _, err := svc.ListClineModels(context.Background(), srv.URL+"/api/v1", "k"); err == nil {
		t.Fatal("both upstreams failing must error")
	}
}

// The OpenRouter key probe validates against /api/v1/key and surfaces the
// key's usage/limit in the detail.
func TestProbeOpenRouterKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/key" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer sk-or-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"data":{"label":"my key","usage":0.25,"limit":10,"is_free_tier":false}}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	result, err := svc.ProbeOpenRouterKey(context.Background(), srv.URL+"/api/v1", "sk-or-key")
	if err != nil {
		t.Fatalf("ProbeOpenRouterKey: %v", err)
	}
	if !result.OK {
		t.Fatalf("result = %+v, want ok", result)
	}
	for _, want := range []string{"my key", "usage $0.2500", "of $10.00"} {
		if !strings.Contains(result.Detail, want) {
			t.Errorf("detail %q missing %q", result.Detail, want)
		}
	}

	result, err = svc.ProbeOpenRouterKey(context.Background(), srv.URL+"/api/v1", "bad")
	if err != nil {
		t.Fatalf("probe bad key: %v", err)
	}
	if result.OK || result.Detail != "credential rejected by provider" {
		t.Errorf("bad key result = %+v", result)
	}
}

func TestProbeCredentialAuthHeaders(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cases := []struct {
		name                        string
		anthropic, oauth            bool
		auth, apiKey, version, beta string
	}{
		{name: "anthropic api key", anthropic: true, apiKey: "k", version: "2023-06-01"},
		{name: "anthropic oauth", anthropic: true, oauth: true, auth: "Bearer k", version: "2023-06-01", beta: "oauth-2025-04-20"},
		{name: "openai", auth: "Bearer k"},
	}
	svc := &UpstreamService{}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := svc.ProbeCredential(context.Background(), srv.URL+"/v1/models", tc.anthropic, tc.oauth, "k")
			if err != nil || !res.OK {
				t.Fatalf("probe = %+v, %v", res, err)
			}
			for header, want := range map[string]string{
				"Authorization":     tc.auth,
				"x-api-key":         tc.apiKey,
				"anthropic-version": tc.version,
				"anthropic-beta":    tc.beta,
			} {
				if v := got.Get(header); v != want {
					t.Errorf("%s = %q, want %q", header, v, want)
				}
			}
		})
	}
}

// A wrong base_url (a website instead of the API root) usually answers with
// an HTML soft-404 at status 200 — ListModels must reject it with a
// base_url-mentioning error instead of the raw json unparseable error.
func TestListModelsRejectsHTMLPage(t *testing.T) {
	for _, tc := range []struct {
		name        string
		contentType string
		body        string
	}{
		{name: "text/html content type", contentType: "text/html; charset=utf-8", body: "<!DOCTYPE html><html><body>not found</body></html>"},
		{name: "unset content type", contentType: "", body: "<html><body>spa fallback</body></html>"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if tc.contentType != "" {
					w.Header().Set("Content-Type", tc.contentType)
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()

			svc := &UpstreamService{}
			_, err := svc.ListModels(context.Background(), srv.URL+"/v1/models", false, false, "k")
			if err == nil {
				t.Fatal("an HTML page must not parse as a model list")
			}
			for _, want := range []string{"HTML", "base_url"} {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q missing %q", err.Error(), want)
				}
			}
		})
	}
}

func TestListModelsParsesJSONWithPricing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"m-b","pricing":{"prompt":"0.0000025","completion":"0.00001"}},{"id":"m-a"}]}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	models, err := svc.ListModels(context.Background(), srv.URL+"/v1/models", false, false, "k")
	if err != nil {
		t.Fatalf("ListModels: %v", err)
	}
	if len(models) != 2 || models[0].ID != "m-a" || models[1].ID != "m-b" {
		t.Errorf("models = %+v, want m-a,m-b sorted", models)
	}
	if models[1].Pricing == nil || models[1].Pricing.InputMicros != 2_500_000 {
		t.Errorf("m-b pricing = %+v, want parsed input rate", models[1].Pricing)
	}
}

// A credential probe against a website root answers 200 with an HTML page;
// that must not count as "credential accepted".
func TestProbeCredentialFlagsHTMLPage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<!DOCTYPE html><html><body>Just a moment…</body></html>"))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	res, err := svc.ProbeCredential(context.Background(), srv.URL+"/v1/models", false, false, "k")
	if err != nil {
		t.Fatalf("ProbeCredential: %v", err)
	}
	if res.OK {
		t.Errorf("result = %+v, want not ok for an HTML page", res)
	}
	for _, want := range []string{"HTML", "base_url"} {
		if !strings.Contains(res.Detail, want) {
			t.Errorf("detail %q missing %q", res.Detail, want)
		}
	}
}

func TestChatCompletionAnthropicOAuth(t *testing.T) {
	var gotHeader http.Header
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Clone()
		gotBody = nil
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"OK"}],"usage":{"input_tokens":3,"output_tokens":1}}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	msgs := []dtos.ModelTestMessage{{Role: "user", Content: "hi"}}

	// Subscription (OAuth) tokens: Bearer + oauth beta, and the Claude Code
	// system prompt Anthropic requires for Sonnet/Opus.
	res, err := svc.ChatCompletion(context.Background(), srv.URL+"/v1", true, true, "tok", "claude-sonnet-4-5", msgs)
	if err != nil || !res.OK || res.Content != "OK" {
		t.Fatalf("oauth result = %+v, %v", res, err)
	}
	if gotHeader.Get("Authorization") != "Bearer tok" || gotHeader.Get("anthropic-beta") != "oauth-2025-04-20" {
		t.Errorf("oauth headers: Authorization=%q anthropic-beta=%q", gotHeader.Get("Authorization"), gotHeader.Get("anthropic-beta"))
	}
	if gotBody["system"] != "You are Claude Code, Anthropic's official CLI for Claude." {
		t.Errorf("oauth system = %v, want the Claude Code prompt", gotBody["system"])
	}

	// API keys keep x-api-key and send no system prompt.
	if _, err := svc.ChatCompletion(context.Background(), srv.URL+"/v1", true, false, "sk-ant", "claude-sonnet-4-5", msgs); err != nil {
		t.Fatal(err)
	}
	if gotHeader.Get("x-api-key") != "sk-ant" || gotHeader.Get("Authorization") != "" {
		t.Errorf("api-key headers: x-api-key=%q Authorization=%q", gotHeader.Get("x-api-key"), gotHeader.Get("Authorization"))
	}
	if _, ok := gotBody["system"]; ok {
		t.Errorf("api-key request must not carry a system prompt, got %v", gotBody["system"])
	}
}
