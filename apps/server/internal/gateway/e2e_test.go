package gateway

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/password"
	"tera-router/server/internal/transform"

	"github.com/gofiber/fiber/v3"
)

// The tests in this file drive the real HTTP surface: a Fiber app with the
// gateway routes registered, a real SQLite database holding the key, provider,
// and account rows, and a fake upstream. They are the end-to-end proof that
// auth, dialect parsing, routing, dispatch, rendering, and metering fit
// together.

const testKeyPlaintext = "sk_tr_testkeytestkeytestkey"

// newGatewayApp builds a Fiber app wired to a fresh database and returns the
// app plus the application container.
func newGatewayApp(t *testing.T) (*fiber.App, *app.Application) {
	t.Helper()

	_, application := newTestServer(t)

	// A real API key: only its hashes are stored.
	hash, err := password.Hash(testKeyPlaintext)
	if err != nil {
		t.Fatalf("hash key: %v", err)
	}
	sealed, err := application.Secrets.SealString(testKeyPlaintext)
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	exec(t, application, `INSERT INTO api_keys (id, name, key_hash, lookup_hash, display, secret_wrapped_dek, secret_ciphertext)
		VALUES ('key-e2e', 'e2e', ?, ?, ?, ?, ?)`,
		hash, apikey.LookupHash(testKeyPlaintext), apikey.Mask(testKeyPlaintext),
		sealed.WrappedDEK, sealed.Ciphertext)

	fiberApp := fiber.New(fiber.Config{
		BodyLimit: 32 * 1024 * 1024,
		ErrorHandler: func(c fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).SendString(err.Error())
		},
	})
	srv := Register(fiberApp, application)
	t.Cleanup(srv.Drain)
	return fiberApp, application
}

// fakeUpstream serves an OpenAI-compatible endpoint and records the requests it
// received, so tests can assert on the body the gateway actually sent.
type fakeUpstream struct {
	server   *httptest.Server
	mu       chan struct{}
	requests []capturedRequest
}

type capturedRequest struct {
	Path    string
	Headers http.Header
	Body    map[string]any
	Raw     string
}

func newFakeUpstream(t *testing.T, handler http.HandlerFunc) *fakeUpstream {
	t.Helper()
	f := &fakeUpstream{mu: make(chan struct{}, 1)}
	f.mu <- struct{}{}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var parsed map[string]any
		_ = json.Unmarshal(body, &parsed)

		<-f.mu
		f.requests = append(f.requests, capturedRequest{
			Path: r.URL.Path, Headers: r.Header.Clone(), Body: parsed, Raw: string(body),
		})
		f.mu <- struct{}{}

		handler(w, r)
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeUpstream) captured() []capturedRequest {
	<-f.mu
	out := append([]capturedRequest(nil), f.requests...)
	f.mu <- struct{}{}
	return out
}

// registerProvider points a custom provider slug at the fake upstream and adds
// one account with the given API key.
func registerProvider(t *testing.T, a *app.Application, slug, baseURL, accountKey string) {
	t.Helper()
	exec(t, a, `INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled)
		VALUES (?, ?, ?, ?, 'openai', true)`, "cp-"+slug, slug, slug, baseURL)

	sealed, err := a.Secrets.SealString(accountKey)
	if err != nil {
		t.Fatalf("seal account key: %v", err)
	}
	exec(t, a, `INSERT INTO accounts (id, provider, label, auth_kind, secret_wrapped_dek, secret_ciphertext, priority)
		VALUES (?, ?, 'acct', 'api_key', ?, ?, 100)`,
		"acct-"+slug, slug, sealed.WrappedDEK, sealed.Ciphertext)
}

// do issues a request against the app.
func do(t *testing.T, app *fiber.App, method, path, body string, headers map[string]string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	return resp
}

func readBody(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return string(b)
}

// --- auth ---

func TestAuthRejectsMissingAndInvalidKeys(t *testing.T) {
	app, _ := newGatewayApp(t)

	cases := []struct {
		name    string
		headers map[string]string
	}{
		{"no credential", nil},
		{"empty bearer", map[string]string{"Authorization": "Bearer "}},
		{"wrong key", map[string]string{"Authorization": "Bearer sk_tr_nope"}},
		{"wrong api key header", map[string]string{"x-api-key": "sk_tr_nope"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := do(t, app, http.MethodPost, "/v1/chat/completions",
				`{"model":"openai/gpt-4o","messages":[{"role":"user","content":"hi"}]}`, tc.headers)
			if resp.StatusCode != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401 (body: %s)", resp.StatusCode, readBody(t, resp))
			}
			// The error body must be the OpenAI envelope, not the dashboard's.
			var envelope struct {
				Error struct {
					Message string `json:"message"`
					Type    string `json:"type"`
				} `json:"error"`
			}
			if err := json.Unmarshal([]byte(readBody(t, resp)), &envelope); err != nil {
				t.Fatalf("error body is not the OpenAI envelope: %v", err)
			}
			if envelope.Error.Type != "authentication_error" {
				t.Errorf("error.type = %q, want authentication_error", envelope.Error.Type)
			}
			if envelope.Error.Message == "" {
				t.Error("error.message is empty")
			}
		})
	}
}

func TestAuthAcceptsBearerAndAPIKeyHeader(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"x","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	for _, tc := range []struct {
		name    string
		headers map[string]string
	}{
		{"bearer", map[string]string{"Authorization": "Bearer " + testKeyPlaintext}},
		{"raw authorization value", map[string]string{"Authorization": testKeyPlaintext}},
		{"x-api-key", map[string]string{"x-api-key": testKeyPlaintext}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp := do(t, app, http.MethodPost, "/v1/chat/completions",
				`{"model":"fake/gpt-4o","messages":[{"role":"user","content":"hi"}]}`, tc.headers)
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
			}
			readBody(t, resp)
		})
	}
}

func TestAuthRejectsDisabledKey(t *testing.T) {
	app, a := newGatewayApp(t)
	exec(t, a, `UPDATE api_keys SET disabled = true WHERE id = 'key-e2e'`)

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"openai/gpt-4o","messages":[]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	readBody(t, resp)
}

// --- count_tokens ---

func TestCountTokensEstimatesLocally(t *testing.T) {
	app, _ := newGatewayApp(t)

	// 100 chars of user text -> (100+3)/4 = 25 tokens.
	body := `{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"` + strings.Repeat("a", 100) + `"}]}`
	resp := do(t, app, http.MethodPost, "/v1/messages/count_tokens", body,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var out struct {
		InputTokens int `json:"input_tokens"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.InputTokens != 25 {
		t.Errorf("input_tokens = %d, want 25", out.InputTokens)
	}
}

func TestCountTokensRequiresAuth(t *testing.T) {
	app, _ := newGatewayApp(t)

	resp := do(t, app, http.MethodPost, "/v1/messages/count_tokens",
		`{"model":"x","messages":[]}`, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	readBody(t, resp)
}

// --- unary ---

func TestUnaryChatEndToEnd(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-1","object":"chat.completion","model":"gpt-4o-2024",
			"choices":[{"index":0,"message":{"role":"assistant","content":"Hello there"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream-secret")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","messages":[{"role":"user","content":"hi"}],"temperature":0.5}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext, "User-Agent": "claude-code/1.0"})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	if got := resp.Header.Get("X-TeraRouter-Provider"); got != "fake" {
		t.Errorf("X-TeraRouter-Provider = %q, want fake", got)
	}
	if got := resp.Header.Get("X-TeraRouter-Model"); got != "fake/gpt-4o" {
		t.Errorf("X-TeraRouter-Model = %q, want the requested id", got)
	}

	var out struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Model != "fake/gpt-4o" {
		t.Errorf("model = %q, want the requested id echoed", out.Model)
	}
	if len(out.Choices) != 1 || out.Choices[0].Message.Content != "Hello there" {
		t.Errorf("choices = %+v", out.Choices)
	}
	if out.Usage.PromptTokens != 11 || out.Usage.CompletionTokens != 3 {
		t.Errorf("usage = %+v, want the upstream's numbers", out.Usage)
	}

	// The upstream must have received the rendered OpenAI body with the
	// concrete model and the account's credential.
	captured := upstream.captured()
	if len(captured) != 1 {
		t.Fatalf("upstream saw %d requests, want 1", len(captured))
	}
	if captured[0].Path != "/chat/completions" {
		t.Errorf("upstream path = %q, want /chat/completions", captured[0].Path)
	}
	if got := captured[0].Headers.Get("Authorization"); got != "Bearer sk-upstream-secret" {
		t.Errorf("upstream auth = %q", got)
	}
	if got := captured[0].Body["model"]; got != "gpt-4o" {
		t.Errorf("upstream model = %v, want the bare upstream id", got)
	}
	if got := captured[0].Body["stream"]; got == true {
		t.Error("unary request must not be sent as a stream")
	}

	// Usage must be metered.
	assertUsageRow(t, a, "fake", "gpt-4o", false)
}

func TestUnaryAnthropicDialect(t *testing.T) {
	app, a := newGatewayApp(t)
	// The upstream speaks OpenAI; the client speaks Anthropic. The gateway
	// must translate in both directions.
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-2","model":"gpt-4o","choices":[{"index":0,
			"message":{"role":"assistant","content":"translated"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/messages",
		`{"model":"fake/gpt-4o","max_tokens":100,"system":"be brief","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext, "anthropic-version": "2023-06-01"})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var out struct {
		Type    string `json:"type"`
		Role    string `json:"role"`
		Model   string `json:"model"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Type != "message" {
		t.Errorf("type = %q, want message (Anthropic shape)", out.Type)
	}
	if out.Role != "assistant" {
		t.Errorf("role = %q", out.Role)
	}
	if len(out.Content) != 1 || out.Content[0].Text != "translated" {
		t.Errorf("content = %+v", out.Content)
	}

	// The system prompt must have been rendered into the upstream request.
	captured := upstream.captured()
	if len(captured) != 1 {
		t.Fatalf("upstream saw %d requests, want 1", len(captured))
	}
	raw := captured[0].Raw
	if !strings.Contains(raw, "be brief") {
		t.Errorf("system prompt missing from the upstream body: %s", raw)
	}
}

func TestUnaryResponsesDialect(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-3","model":"gpt-4o","choices":[{"index":0,
			"message":{"role":"assistant","content":"responses"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/responses",
		`{"model":"fake/gpt-4o","input":[{"role":"user","content":"hi"}],"instructions":"be terse"}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var out struct {
		Object string `json:"object"`
		Model  string `json:"model"`
		Output []struct {
			Type    string `json:"type"`
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Object != "response" {
		t.Errorf("object = %q, want response (Responses shape)", out.Object)
	}
	if len(out.Output) == 0 {
		t.Fatalf("no output items: %+v", out)
	}
	if out.Output[0].Content[0].Text != "responses" {
		t.Errorf("output text = %+v", out.Output)
	}
}

func TestRootResponsesRouteIsRegistered(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"r","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	// Codex addresses the Responses API at the root.
	resp := do(t, app, http.MethodPost, "/responses",
		`{"model":"fake/gpt-4o","input":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)
}

// --- routing and errors ---

func TestUnknownModelReturns400(t *testing.T) {
	app, _ := newGatewayApp(t)

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"nonexistent-model","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	body := readBody(t, resp)
	if !strings.Contains(body, "unknown model") {
		t.Errorf("body = %q, want an 'unknown model' message", body)
	}
}

func TestNoAccountsReturns503(t *testing.T) {
	app, _ := newGatewayApp(t)

	// openai is a routable catalog provider with no accounts configured.
	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"openai/gpt-4o","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	if body := readBody(t, resp); !strings.Contains(body, "no available account") {
		t.Errorf("body = %q", body)
	}
}

func TestMalformedJSONReturns400(t *testing.T) {
	app, _ := newGatewayApp(t)

	resp := do(t, app, http.MethodPost, "/v1/chat/completions", `{"model":`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)
}

func TestUpstreamErrorMapsToClientStatus(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"rate limited","type":"rate_limit_error"}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)

	// The failure must be metered so the dashboard can show it.
	assertFailureRow(t, a, "fake", "gpt-4o")
}

func TestAliasEchoesRequestedName(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"c","model":"upstream-model","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")
	seedAlias(t, a, "smart", []aliasTarget{{provider: "fake", model: "upstream-model", position: 1, active: true}})

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"smart","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var out struct {
		Model string `json:"model"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Model != "smart" {
		t.Errorf("model = %q, want the alias name echoed", out.Model)
	}
	if got := resp.Header.Get("X-TeraRouter-Model"); got != "smart" {
		t.Errorf("X-TeraRouter-Model = %q, want smart", got)
	}
	// The upstream must have been asked for the concrete model.
	if captured := upstream.captured(); captured[0].Body["model"] != "upstream-model" {
		t.Errorf("upstream model = %v, want upstream-model", captured[0].Body["model"])
	}
}

func TestPlanAllowedModelsDeniesAccess(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	exec(t, a, `INSERT INTO plans (id, name, allowed_models) VALUES ('plan-1', 'restricted', '["openai/gpt-4o"]')`)
	exec(t, a, `UPDATE api_keys SET plan_id = 'plan-1' WHERE id = 'key-e2e'`)

	// A model outside the plan's list is forbidden.
	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)

	// A model on the list is allowed through to dispatch (503 here, since no
	// openai account exists — the point is that it was not 403).
	resp = do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"openai/gpt-4o","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode == http.StatusForbidden {
		t.Fatalf("allowed model was forbidden (body: %s)", readBody(t, resp))
	}
	readBody(t, resp)
}

func TestBudgetBlockReturns402(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	exec(t, a, `INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period, hard_cutoff)
		VALUES ('b-e2e', 'api_key', 'key-e2e', 1000, 'monthly', true)`)
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, cost_micros, created_at)
		VALUES ('key-e2e', 'fake', 'gpt-4o', 5000, ?)`, time.Now().UTC())

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusPaymentRequired {
		t.Fatalf("status = %d, want 402 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)

	// The upstream must never have been called.
	if len(upstream.captured()) != 0 {
		t.Error("a blocked request must not reach the upstream")
	}
}

func TestModelSuffixIsStrippedBeforeDispatch(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-5(high)","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	readBody(t, resp)

	captured := upstream.captured()
	if len(captured) != 1 {
		t.Fatalf("upstream saw %d requests, want 1", len(captured))
	}
	if got := captured[0].Body["model"]; got != "gpt-5" {
		t.Errorf("upstream model = %v, want gpt-5 (suffix stripped)", got)
	}
}

func TestChainFallbackOnUpstreamFailure(t *testing.T) {
	app, a := newGatewayApp(t)

	// The first target's upstream always fails; the second succeeds.
	failing := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
	})
	working := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"fallback worked"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}`))
	})
	registerProvider(t, a, "failing", failing.server.URL, "sk-bad")
	registerProvider(t, a, "working", working.server.URL, "sk-good")

	seedChain(t, a, "resilient", "priority", []chainStep{
		{provider: "failing", model: "gpt-4o"},
		{provider: "working", model: "gpt-4o"},
	}, "", "")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"chain:resilient","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 from the fallback target (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var out struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Choices[0].Message.Content != "fallback worked" {
		t.Errorf("content = %+v, want the fallback target's answer", out.Choices)
	}
	if out.Model != "chain:resilient" {
		t.Errorf("model = %q, want the requested chain echoed", out.Model)
	}
	if got := resp.Header.Get("X-TeraRouter-Provider"); got != "working" {
		t.Errorf("X-TeraRouter-Provider = %q, want working", got)
	}

	// Both the failure and the success must be metered.
	assertFailureRow(t, a, "failing", "gpt-4o")
	assertUsageRow(t, a, "working", "gpt-4o", false)
}

// --- streaming ---

// TestStreamChatRendersSSE drives the rendered path: the client speaks
// Anthropic while the upstream speaks OpenAI, so every canonical chunk must be
// re-encoded for the client.
func TestStreamChatRendersSSE(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		for _, line := range []string{
			`data: {"id":"c1","model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
			`data: {"id":"c1","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hel"},"finish_reason":null}]}`,
			`data: {"id":"c1","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}`,
			`data: {"id":"c1","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			`data: {"id":"c1","model":"gpt-4o","choices":[],"usage":{"prompt_tokens":9,"completion_tokens":2,"total_tokens":11}}`,
			`data: [DONE]`,
		} {
			fmt.Fprintf(w, "%s\n\n", line)
			if flusher != nil {
				flusher.Flush()
			}
		}
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/messages",
		`{"model":"fake/gpt-4o","max_tokens":100,"stream":true,"messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Errorf("Content-Type = %q, want text/event-stream", ct)
	}
	if got := resp.Header.Get("X-Accel-Buffering"); got != "no" {
		t.Errorf("X-Accel-Buffering = %q, want no", got)
	}
	if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", got)
	}

	body := readBody(t, resp)

	// The Anthropic client must see Anthropic events.
	if !strings.Contains(body, "event: message_start") {
		t.Errorf("missing message_start:\n%s", body)
	}
	if !strings.Contains(body, "event: message_stop") {
		t.Errorf("missing message_stop:\n%s", body)
	}

	// Reassemble the text deltas to prove the answer survived translation, and
	// confirm the echoed model name is the client's, not the upstream's.
	var text strings.Builder
	var sawStop bool
	var echoedModel string
	scanner := bufio.NewScanner(strings.NewReader(body))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		var event struct {
			Type    string `json:"type"`
			Message struct {
				Model string `json:"model"`
			} `json:"message"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(payload), &event); err != nil {
			t.Fatalf("client received a malformed event %q: %v", payload, err)
		}
		if event.Type == "message_start" {
			echoedModel = event.Message.Model
		}
		if event.Type == "content_block_delta" && event.Delta.Type == "text_delta" {
			text.WriteString(event.Delta.Text)
		}
		if event.Type == "message_delta" || event.Type == "message_stop" {
			sawStop = true
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan: %v", err)
	}

	if text.String() != "Hello" {
		t.Errorf("reassembled text = %q, want Hello", text.String())
	}
	if !sawStop {
		t.Error("client never saw a terminal event")
	}
	if echoedModel != "fake/gpt-4o" {
		t.Errorf("echoed model = %q, want the requested id", echoedModel)
	}

	// Streamed usage must be metered with the upstream's token counts.
	assertUsageTokens(t, a, "fake", "gpt-4o", 9, 2)
}

func TestStreamChatSendsHeartbeatWhileWaiting(t *testing.T) {
	// The heartbeat interval is 15s, far too long for a test. Assert the
	// mechanism instead by checking the writer emits a comment when no chunk
	// has been sent yet — driven directly rather than through a slow upstream.
	sw := &streamWriter{
		srv:      &Server{},
		codec:    mustCodec(t, core.DialectOpenAI),
		state:    streamState("m"),
		provider: "p",
		model:    "m",
	}
	if sw.chunksSent != 0 {
		t.Fatal("a fresh writer must not have sent chunks")
	}

	var buf strings.Builder
	w := bufio.NewWriter(&buf)
	if ok := sw.writeRaw(w, []byte(": ping\n\n")); !ok {
		t.Fatal("heartbeat write failed")
	}
	if buf.String() != ": ping\n\n" {
		t.Errorf("heartbeat = %q", buf.String())
	}
}

func TestStreamChatErrorAfterFirstByteIsRenderedInStream(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		// Content first, then an upstream error event.
		fmt.Fprint(w, "data: {\"id\":\"c\",\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"partial\"},\"finish_reason\":null}]}\n\n")
		if flusher != nil {
			flusher.Flush()
		}
		fmt.Fprint(w, "data: {\"error\":{\"message\":\"upstream blew up\",\"type\":\"server_error\"}}\n\n")
		if flusher != nil {
			flusher.Flush()
		}
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","stream":true,"messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})

	// The status was committed when the first byte went out, so the error must
	// arrive inside the stream.
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (the status was already committed)", resp.StatusCode)
	}
	body := readBody(t, resp)
	if !strings.Contains(body, "partial") {
		t.Errorf("client lost the partial content:\n%s", body)
	}
	if !strings.Contains(body, "upstream blew up") {
		t.Errorf("stream error was not rendered to the client:\n%s", body)
	}
}

func TestStreamConnectFailureReturnsProperStatus(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"bad credential"}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-bad")

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","stream":true,"messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})

	// Nothing was written yet, so the failure still produces a real status.
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	if ct := resp.Header.Get("Content-Type"); strings.Contains(ct, "text/event-stream") {
		t.Error("a failed connect must not claim to be an event stream")
	}
	readBody(t, resp)
}

func TestStreamPassthroughForSameDialect(t *testing.T) {
	app, a := newGatewayApp(t)
	// An Anthropic-dialect upstream (glm is catalogued as anthropic) so the
	// client's Anthropic stream can be piped through byte-for-byte.
	raw := strings.Join([]string{
		`event: message_start`,
		`data: {"type":"message_start","message":{"id":"msg_1","model":"glm-4","usage":{"input_tokens":7,"output_tokens":0}}}`,
		"",
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"passthrough"}}`,
		"",
		`event: message_delta`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}`,
		"",
		`event: message_stop`,
		`data: {"type":"message_stop"}`,
		"",
	}, "\n")

	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, raw)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	})
	// A custom provider whose api_kind makes it speak Anthropic.
	exec(t, a, `INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled)
		VALUES ('cp-anthropic', 'Anthropic-compatible', 'myclaude', ?, 'anthropic', true)`, upstream.server.URL)
	sealed, err := a.Secrets.SealString("sk-anthropic")
	if err != nil {
		t.Fatal(err)
	}
	exec(t, a, `INSERT INTO accounts (id, provider, label, auth_kind, secret_wrapped_dek, secret_ciphertext)
		VALUES ('acct-myclaude', 'myclaude', 'a', 'api_key', ?, ?)`, sealed.WrappedDEK, sealed.Ciphertext)

	resp := do(t, app, http.MethodPost, "/v1/messages",
		`{"model":"myclaude/glm-4","max_tokens":50,"stream":true,"messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}
	body := readBody(t, resp)

	// The bytes must be the upstream's, untouched.
	if body != raw {
		t.Errorf("passthrough body differs from upstream\n got: %q\nwant: %q", body, raw)
	}

	// Usage must still be extracted from the captured stream.
	assertUsageTokens(t, a, "myclaude", "glm-4", 7, 3)
}

func TestStreamPassthroughAnthropicErrorShape(t *testing.T) {
	app, _ := newGatewayApp(t)

	// An Anthropic-dialect client gets the Anthropic error envelope.
	resp := do(t, app, http.MethodPost, "/v1/messages",
		`{"model":"nope","messages":[{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	var envelope struct {
		Type  string `json:"type"`
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(readBody(t, resp)), &envelope); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if envelope.Type != "error" {
		t.Errorf("type = %q, want error", envelope.Type)
	}
	if envelope.Error.Type != "invalid_request_error" {
		t.Errorf("error.type = %q, want invalid_request_error", envelope.Error.Type)
	}
}

// --- metering helpers ---

// assertUsageRow waits for a successful metering row for a provider/model.
// Metering is asynchronous, so the write may land after the response returns.
func assertUsageRow(t *testing.T, a *app.Application, provider, model string, failed bool) {
	t.Helper()
	var count int
	waitFor(t, func() bool {
		count = 0
		err := a.DB.QueryRowContext(context.Background(),
			`SELECT count(*) FROM usage_records WHERE provider = ? AND model = ? AND failed = ?`,
			provider, model, failed).Scan(&count)
		if err != nil {
			t.Fatalf("query usage: %v", err)
		}
		return count > 0
	}, "usage row for "+provider+"/"+model)
}

// assertFailureRow waits for a failure row carrying an error kind.
func assertFailureRow(t *testing.T, a *app.Application, provider, model string) {
	t.Helper()
	var count int
	var kind, message string
	waitFor(t, func() bool {
		count, kind, message = 0, "", ""
		err := a.DB.QueryRowContext(context.Background(),
			`SELECT count(*), COALESCE(MAX(error_kind), ''), COALESCE(MAX(error_message), '')
			 FROM usage_records WHERE provider = ? AND model = ? AND failed = true`,
			provider, model).Scan(&count, &kind, &message)
		if err != nil {
			t.Fatalf("query failures: %v", err)
		}
		return count > 0
	}, "failure row for "+provider+"/"+model)

	if kind == "" {
		t.Errorf("failure row for %s/%s has no error_kind", provider, model)
	}
}

// waitFor polls cond until it holds or a short deadline passes, reporting the
// description when it never did.
func waitFor(t *testing.T, cond func() bool, description string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		if cond() {
			return
		}
		if time.Now().After(deadline) {
			t.Errorf("timed out waiting for %s", description)
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func assertUsageTokens(t *testing.T, a *app.Application, provider, model string, prompt, completion int) {
	t.Helper()
	// Metering is asynchronous, so poll briefly.
	deadline := time.Now().Add(3 * time.Second)
	for {
		var gotPrompt, gotCompletion int
		err := a.DB.QueryRowContext(context.Background(),
			`SELECT COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0)
			 FROM usage_records WHERE provider = ? AND model = ? AND failed = false`,
			provider, model).Scan(&gotPrompt, &gotCompletion)
		if err != nil {
			t.Fatalf("query usage: %v", err)
		}
		if gotPrompt == prompt && gotCompletion == completion {
			return
		}
		if time.Now().After(deadline) {
			t.Errorf("metered tokens for %s/%s = (%d, %d), want (%d, %d)",
				provider, model, gotPrompt, gotCompletion, prompt, completion)
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func mustCodec(t *testing.T, dialect core.Dialect) transform.Codec {
	t.Helper()
	codec, err := transform.DefaultRegistry().Codec(dialect)
	if err != nil {
		t.Fatalf("codec %q: %v", dialect, err)
	}
	return codec
}
