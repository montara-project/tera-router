package connectors

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

// newTestRegistry builds a registry over the real codec set.
func newTestRegistry(t *testing.T) *Registry {
	t.Helper()
	return New(transform.DefaultRegistry())
}

func testRequest() *core.ChatRequest {
	return &core.ChatRequest{
		Model:    "gpt-4o-mini",
		Messages: []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}},
	}
}

// capture records the last request the fake upstream received.
type capture struct {
	path    string
	headers http.Header
	body    map[string]any
	raw     []byte
}

func (c *capture) record(r *http.Request) {
	c.path = r.URL.Path
	c.headers = r.Header.Clone()
	c.raw, _ = io.ReadAll(r.Body)
	_ = json.Unmarshal(c.raw, &c.body)
}

func TestChatUnaryOpenAISuccess(t *testing.T) {
	var got capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.record(r)
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{
			"id":"chatcmpl-1","model":"gpt-4o-mini",
			"choices":[{"message":{"role":"assistant","content":"hello there"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}
		}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, err := reg.For("openai", core.DialectOpenAI, srv.URL+"/v1")
	if err != nil {
		t.Fatalf("For: %v", err)
	}

	resp, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "sk-test"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}

	if got.path != "/v1/chat/completions" {
		t.Errorf("path = %q, want /v1/chat/completions", got.path)
	}
	if got.headers.Get("Authorization") != "Bearer sk-test" {
		t.Errorf("Authorization = %q", got.headers.Get("Authorization"))
	}
	if stream, _ := got.body["stream"].(bool); stream {
		t.Errorf("unary request must not set stream=true, body=%s", got.raw)
	}
	if resp.ID != "chatcmpl-1" {
		t.Errorf("ID = %q, want chatcmpl-1", resp.ID)
	}
	if text := resp.Message.TextContent(); text != "hello there" {
		t.Errorf("text = %q, want %q", text, "hello there")
	}
	if resp.FinishReason != core.FinishStop {
		t.Errorf("finish = %q, want stop", resp.FinishReason)
	}
	if resp.Usage.PromptTokens != 3 || resp.Usage.CompletionTokens != 2 || resp.Usage.TotalTokens != 5 {
		t.Errorf("usage = %+v", resp.Usage)
	}
}

func TestChatDoesNotMutateCallerRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"id":"x","choices":[{"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}]}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, err := reg.For("openai", core.DialectOpenAI, srv.URL)
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	req := testRequest()
	req.Stream = true // caller asked for a stream; Chat must not honour it in-place
	if _, err := conn.Chat(context.Background(), req, core.Credentials{APIKey: "k"}); err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if !req.Stream {
		t.Error("Chat mutated the caller's Stream flag")
	}
}

func TestChatRateLimitRetryAfter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "7")
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `{"error":{"message":"Rate limit reached for gpt-4o","type":"rate_limit_error"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k", AccountID: "acct-1"})
	pe := core.AsProviderError(err)
	if pe.Kind != core.ErrRateLimit {
		t.Fatalf("kind = %q, want %q (err=%v)", pe.Kind, core.ErrRateLimit, err)
	}
	if pe.RetryAfter != 7*time.Second {
		t.Errorf("RetryAfter = %v, want 7s", pe.RetryAfter)
	}
	if pe.StatusCode != 429 {
		t.Errorf("StatusCode = %d, want 429", pe.StatusCode)
	}
	if pe.Provider != "openai" || pe.Model != "gpt-4o-mini" || pe.AccountID != "acct-1" {
		t.Errorf("identity = %q/%q/%q", pe.Provider, pe.Model, pe.AccountID)
	}
	if !strings.Contains(pe.Message, "Rate limit reached") {
		t.Errorf("message = %q, want the upstream error text", pe.Message)
	}
}

func TestChatRetryAfterMilliseconds(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("retry-after-ms", "1500")
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `{"error":{"message":"slow down"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if got := core.AsProviderError(err).RetryAfter; got != 1500*time.Millisecond {
		t.Errorf("RetryAfter = %v, want 1.5s", got)
	}
}

func TestChatRetryAfterHTTPDate(t *testing.T) {
	future := time.Now().Add(90 * time.Second).UTC().Format(http.TimeFormat)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", future)
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `{"error":{"message":"slow down"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	got := core.AsProviderError(err).RetryAfter
	if got < 80*time.Second || got > 90*time.Second {
		t.Errorf("RetryAfter = %v, want ~90s", got)
	}
}

func TestChatAuthError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		io.WriteString(w, `{"error":{"message":"Incorrect API key provided","type":"invalid_request_error","code":"invalid_api_key"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "bad"})
	pe := core.AsProviderError(err)
	if pe.Kind != core.ErrAuth {
		t.Fatalf("kind = %q, want %q", pe.Kind, core.ErrAuth)
	}
	if pe.StatusCode != 401 {
		t.Errorf("StatusCode = %d, want 401", pe.StatusCode)
	}
	if !strings.Contains(pe.Message, "Incorrect API key") {
		t.Errorf("message = %q", pe.Message)
	}
}

func TestChatContextTooLargePromotion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, `{"error":{"message":"This model's maximum context length is 128000 tokens","code":"context_length_exceeded"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrContextTooLarge {
		t.Errorf("kind = %q, want %q", kind, core.ErrContextTooLarge)
	}
}

func TestChatAggregatesSSEBody(t *testing.T) {
	// An upstream that streams even for a non-streaming request.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"id\":\"c1\",\"model\":\"gpt-4o-mini\",\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"Hel\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"},\"finish_reason\":\"stop\"}]}\n\n")
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	resp, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if got := resp.Message.TextContent(); got != "Hello" {
		t.Errorf("text = %q, want Hello", got)
	}
	if resp.FinishReason != core.FinishStop {
		t.Errorf("finish = %q, want stop", resp.FinishReason)
	}
}

func TestStreamOpenAI(t *testing.T) {
	var got capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.record(r)
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		io.WriteString(w, "data: {\"id\":\"c1\",\"model\":\"gpt-4o-mini\",\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"Hel\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"{\\\"city\\\":\"}}]}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"Paris\\\"}\"}}]}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":4,\"completion_tokens\":9,\"total_tokens\":13}}\n\n")
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	var ttft time.Duration
	ch, err := conn.Stream(context.Background(), testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{
		OnFirstChunk: func(d time.Duration) { ttft = d },
	})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}
	if !got.body["stream"].(bool) {
		t.Errorf("stream request must set stream=true, body=%s", got.raw)
	}
	if got.headers.Get("Accept") != "text/event-stream" {
		t.Errorf("Accept = %q", got.headers.Get("Accept"))
	}

	chunks := drain(t, ch)
	if ttft <= 0 {
		t.Error("OnFirstChunk was never called")
	}

	var text, args strings.Builder
	var finish core.FinishReason
	var usage *core.Usage
	toolCalls := map[int]*core.ToolCall{}
	for _, c := range chunks {
		switch c.Type {
		case core.ChunkText:
			text.WriteString(c.Delta)
		case core.ChunkToolCall:
			tc, ok := toolCalls[c.Index]
			if !ok {
				tc = &core.ToolCall{}
				toolCalls[c.Index] = tc
			}
			if c.ToolCall.ID != "" {
				tc.ID = c.ToolCall.ID
			}
			if c.ToolCall.Name != "" {
				tc.Name = c.ToolCall.Name
			}
			args.Write(c.ToolCall.Arguments)
		case core.ChunkFinish:
			finish = c.FinishReason
		case core.ChunkUsage:
			usage = c.Usage
		case core.ChunkError:
			t.Fatalf("unexpected error chunk: %v", c.Err)
		}
	}
	if text.String() != "Hello" {
		t.Errorf("text = %q, want Hello", text.String())
	}
	if args.String() != `{"city":"Paris"}` {
		t.Errorf("args = %q", args.String())
	}
	tc := toolCalls[0]
	if tc == nil || tc.ID != "call_1" || tc.Name != "get_weather" {
		t.Errorf("tool call = %+v", tc)
	}
	if finish != core.FinishToolCalls {
		t.Errorf("finish = %q, want tool_calls", finish)
	}
	if usage == nil || usage.TotalTokens != 13 {
		t.Errorf("usage = %+v", usage)
	}
}

func TestStreamStalledUpstreamYieldsTimeout(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		// One real chunk, then silence until the context expires.
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"par\"}}]}\n\n")
		w.(http.Flusher).Flush()
		<-release
	}))
	defer srv.Close()
	defer close(release)

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	ch, err := conn.Stream(ctx, testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}
	chunks := drain(t, ch)

	if len(chunks) == 0 || chunks[0].Type != core.ChunkText {
		t.Fatalf("chunks = %+v, want a leading text chunk", chunks)
	}
	last := chunks[len(chunks)-1]
	if last.Type != core.ChunkError {
		t.Fatalf("last chunk = %+v, want a timeout error chunk", last)
	}
	if kind := core.AsProviderError(last.Err).Kind; kind != core.ErrTimeout {
		t.Errorf("kind = %q, want %q", kind, core.ErrTimeout)
	}
}

func TestStreamDeadlineMidStreamIsTimeout(t *testing.T) {
	// The upstream holds the connection open past the deadline. The resulting
	// read failure must classify as a timeout (retryable, fallbackable), not as
	// an empty stream.
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		<-release
	}))
	defer srv.Close()
	defer close(release)

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	ch, err := conn.Stream(ctx, testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	chunks := drain(t, ch)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkError {
		t.Fatalf("chunks = %+v, want a single error chunk", chunks)
	}
	pe := core.AsProviderError(chunks[0].Err)
	if pe.Kind != core.ErrTimeout {
		t.Errorf("kind = %q, want %q", pe.Kind, core.ErrTimeout)
	}
	if !pe.Retryable() {
		t.Error("a mid-stream timeout must be retryable")
	}
}

func TestStreamClosesOnUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"par\"}}]}\n\n")
		io.WriteString(w, "data: {\"error\":{\"message\":\"rate limit exceeded\",\"type\":\"rate_limit_error\"}}\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ch, err := conn.Stream(context.Background(), testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	var errChunk *core.StreamChunk
	var last core.StreamChunk
	for c := range ch {
		last = c
		if c.Type == core.ChunkError {
			cc := c
			errChunk = &cc
		}
	}
	if errChunk == nil {
		t.Fatal("stream did not emit a ChunkError")
	}
	if last.Type != core.ChunkError {
		t.Errorf("last chunk = %q, want error (error must terminate the stream)", last.Type)
	}
	pe := core.AsProviderError(errChunk.Err)
	if pe.Kind != core.ErrRateLimit {
		t.Errorf("kind = %q, want %q", pe.Kind, core.ErrRateLimit)
	}
	if pe.Provider != "openai" || pe.Model != "gpt-4o-mini" {
		t.Errorf("identity = %q/%q", pe.Provider, pe.Model)
	}
}

func TestStreamEmptyEmitsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, ": keepalive\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ch, err := conn.Stream(context.Background(), testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}
	chunks := drain(t, ch)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkError {
		t.Fatalf("chunks = %+v, want a single error chunk", chunks)
	}
	if kind := core.AsProviderError(chunks[0].Err).Kind; kind != core.ErrEmptyStream {
		t.Errorf("kind = %q, want %q", kind, core.ErrEmptyStream)
	}
}

func TestStreamConnectErrorClassified(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		io.WriteString(w, `{"error":{"message":"bad key"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ch, err := conn.Stream(context.Background(), testRequest(), core.Credentials{APIKey: "bad"}, core.StreamConfig{})
	if err == nil {
		drain(t, ch)
		t.Fatal("Stream returned no connect error for a 401")
	}
	if kind := core.AsProviderError(err).Kind; kind != core.ErrAuth {
		t.Errorf("kind = %q, want %q", kind, core.ErrAuth)
	}
}

func TestStreamRawReturnsBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("X-Upstream", "fake")
		io.WriteString(w, "data: {\"id\":\"c1\"}\n\ndata: [DONE]\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	body, hdr, err := conn.(core.DirectStreamable).StreamRaw(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if err != nil {
		t.Fatalf("StreamRaw: %v", err)
	}
	defer body.Close()
	raw, _ := io.ReadAll(body)
	if !strings.Contains(string(raw), "[DONE]") {
		t.Errorf("raw body = %q", raw)
	}
	if hdr.Get("X-Upstream") != "fake" {
		t.Errorf("headers = %v", hdr)
	}
}

func TestStreamRawClassifiedError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		io.WriteString(w, `{"error":{"message":"insufficient balance"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, _, err := conn.(core.DirectStreamable).StreamRaw(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrAccountSuspended {
		t.Errorf("kind = %q, want %q", kind, core.ErrAccountSuspended)
	}
}

func TestRetryAfterFromBodyResetWindow(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `{"error":{"message":"rate limited","retry_after":12}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if got := core.AsProviderError(err).RetryAfter; got != 12*time.Second {
		t.Errorf("RetryAfter = %v, want 12s", got)
	}
}

func TestRetryAfterBodyWindowIsClamped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		// A daily quota window must not strand the account for hours.
		io.WriteString(w, `{"error":{"message":"rate limited","retry_after":86400}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if got := core.AsProviderError(err).RetryAfter; got != maxBodyRateLimitCooldown {
		t.Errorf("RetryAfter = %v, want it clamped to %v", got, maxBodyRateLimitCooldown)
	}
}

func TestAnthropicAuthHeaders(t *testing.T) {
	var got capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.record(r)
		io.WriteString(w, `{"id":"msg_1","model":"claude-sonnet-4-20250514","role":"assistant","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, err := reg.For("anthropic", core.DialectAnthropic, srv.URL+"/v1")
	if err != nil {
		t.Fatalf("For: %v", err)
	}

	if _, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "sk-ant"}); err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if got.path != "/v1/messages" {
		t.Errorf("path = %q, want /v1/messages", got.path)
	}
	if got.headers.Get("x-api-key") != "sk-ant" {
		t.Errorf("x-api-key = %q", got.headers.Get("x-api-key"))
	}
	if got.headers.Get("Authorization") != "" {
		t.Errorf("API-key auth must not also send Authorization, got %q", got.headers.Get("Authorization"))
	}
	if got.headers.Get("anthropic-version") != "2023-06-01" {
		t.Errorf("anthropic-version = %q", got.headers.Get("anthropic-version"))
	}
	if got.headers.Get("anthropic-beta") != "" {
		t.Errorf("API-key auth must not send the oauth beta, got %q", got.headers.Get("anthropic-beta"))
	}

	// OAuth tokens use the bearer scheme instead of x-api-key.
	if _, err := conn.Chat(context.Background(), testRequest(), core.Credentials{AccessToken: "oauth-tok"}); err != nil {
		t.Fatalf("Chat(oauth): %v", err)
	}
	if got.headers.Get("Authorization") != "Bearer oauth-tok" {
		t.Errorf("Authorization = %q", got.headers.Get("Authorization"))
	}
	if got.headers.Get("x-api-key") != "" {
		t.Errorf("OAuth auth must not send x-api-key, got %q", got.headers.Get("x-api-key"))
	}
	if got.headers.Get("anthropic-beta") != "oauth-2025-04-20" {
		t.Errorf("OAuth anthropic-beta = %q, want oauth-2025-04-20", got.headers.Get("anthropic-beta"))
	}

	// An operator-configured beta is kept alongside the oauth flag.
	creds := core.Credentials{AccessToken: "oauth-tok", Headers: map[string]string{"Anthropic-Beta": "prompt-caching-2024-07-31"}}
	if _, err := conn.Chat(context.Background(), testRequest(), creds); err != nil {
		t.Fatalf("Chat(oauth+beta): %v", err)
	}
	if got.headers.Get("anthropic-beta") != "oauth-2025-04-20,prompt-caching-2024-07-31" {
		t.Errorf("merged anthropic-beta = %q", got.headers.Get("anthropic-beta"))
	}
}

func TestClientForProxyCaching(t *testing.T) {
	if c := clientFor(core.Credentials{}); c != sharedClient {
		t.Error("no proxy configured should use the shared client")
	}
	a := clientFor(core.Credentials{ProxyURL: "http://proxy-a.example:8080"})
	b := clientFor(core.Credentials{ProxyURL: "http://proxy-a.example:8080"})
	c := clientFor(core.Credentials{ProxyURL: "http://proxy-b.example:8080"})

	// The client (and therefore its transport) is cached per proxy URL, so a
	// per-account proxy does not allocate a fresh connection pool per request.
	if a != b {
		t.Error("the same proxy URL should reuse one client")
	}
	if a == c {
		t.Error("different proxy URLs must not share a client")
	}
	if a.Transport == sharedClient.Transport {
		t.Error("a proxied client must not reuse the shared transport")
	}
	if a.Timeout != 0 {
		t.Errorf("upstream clients must not carry an overall Timeout (got %v); the context governs", a.Timeout)
	}
	if sharedClient.Timeout != 0 {
		t.Errorf("the shared client must not carry an overall Timeout (got %v)", sharedClient.Timeout)
	}
}

func TestHTMLForbiddenIsUpstreamBlocked(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusForbidden)
		io.WriteString(w, "<html><body>Access denied by CDN</body></html>")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrUpstreamBlocked {
		t.Errorf("kind = %q, want %q", kind, core.ErrUpstreamBlocked)
	}
}

func TestJSONForbiddenIsAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		io.WriteString(w, `{"error":{"message":"your account is not allowed to use this model"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrAuth {
		t.Errorf("kind = %q, want %q", kind, core.ErrAuth)
	}
}

func TestModelNotFoundPromotion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, `{"error":{"message":"The model 'gpt-9' does not exist","code":"model_not_found"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrModelNotFound {
		t.Errorf("kind = %q, want %q", kind, core.ErrModelNotFound)
	}
}

func TestQuotaBodyOverridesUnauthorizedStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		io.WriteString(w, `{"error":{"message":"Your free quota has been exhausted"}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	pe := core.AsProviderError(err)
	if pe.Kind != core.ErrQuotaExhausted {
		t.Errorf("kind = %q, want %q", pe.Kind, core.ErrQuotaExhausted)
	}
	// ErrQuotaExhausted is fallbackable but not retryable on the same account.
	if !pe.Fallbackable() || pe.Retryable() {
		t.Errorf("quota exhaustion should fall back without retrying (retryable=%v fallbackable=%v)",
			pe.Retryable(), pe.Fallbackable())
	}
}

func TestWAFBlockBodyDoesNotOverrideUpstreamBlocked(t *testing.T) {
	// A CDN block page mentions "rate limit" in prose; the HTML/403 signal must
	// win over a substring scan.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusForbidden)
		io.WriteString(w, `<html><body>Error 1015: You are being rate limited. Ray ID: abc</body></html>`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrUpstreamBlocked {
		t.Errorf("kind = %q, want %q", kind, core.ErrUpstreamBlocked)
	}
}

func TestContextTooLargeNotOverriddenByRateLimitWords(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, `{"error":{"message":"This model's maximum context length is 8192 tokens. Please reduce the length of the messages."}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if kind := core.AsProviderError(err).Kind; kind != core.ErrContextTooLarge {
		t.Errorf("kind = %q, want %q", kind, core.ErrContextTooLarge)
	}
}

func TestCreditExhausted200BodyIsBilling(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		io.WriteString(w, "Your credits have been exhausted for this account.")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	_, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	pe := core.AsProviderError(err)
	if pe.Kind != core.ErrBilling {
		t.Fatalf("kind = %q, want %q", pe.Kind, core.ErrBilling)
	}
	if !pe.Fallbackable() || pe.Retryable() {
		t.Errorf("billing should fall back without retrying (retryable=%v fallbackable=%v)",
			pe.Retryable(), pe.Fallbackable())
	}
}

func TestNormalCompletionMentioningCreditsParses(t *testing.T) {
	// A legitimate completion whose text mentions credits must not be
	// mistaken for a billing failure.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"id":"c1","choices":[{"message":{"role":"assistant","content":"Your credits have been exhausted."},"finish_reason":"stop"}]}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	resp, err := conn.Chat(context.Background(), testRequest(), core.Credentials{APIKey: "k"})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if got := resp.Message.TextContent(); got != "Your credits have been exhausted." {
		t.Errorf("text = %q", got)
	}
}

func TestCredentialsHeadersMergeLast(t *testing.T) {
	var got capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.record(r)
		io.WriteString(w, `{"id":"msg_1","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, _ := reg.For("anthropic", core.DialectAnthropic, srv.URL)

	if _, err := conn.Chat(context.Background(), testRequest(), core.Credentials{
		APIKey:  "sk-ant",
		Headers: map[string]string{"anthropic-version": "2024-01-01", "X-Custom": "yes"},
	}); err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if got.headers.Get("anthropic-version") != "2024-01-01" {
		t.Errorf("credential headers must win, got %q", got.headers.Get("anthropic-version"))
	}
	if got.headers.Get("X-Custom") != "yes" {
		t.Errorf("X-Custom = %q", got.headers.Get("X-Custom"))
	}
}

func TestResponsesURLJoin(t *testing.T) {
	cases := []struct {
		name string
		base string
		want string
	}{
		{"plain base gains suffix", "/v1", "/v1/responses"},
		{"responses base used as-is", "/backend-api/codex/responses", "/backend-api/codex/responses"},
		{"trailing slash tolerated", "/v1/", "/v1/responses"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := &connector{id: "codex", dialect: core.DialectOpenAIResponses, defaultBase: "https://api.example.com" + tc.base}
			got := c.endpoint(core.Credentials{})
			want := "https://api.example.com" + tc.want
			if got != want {
				t.Errorf("endpoint = %q, want %q", got, want)
			}
		})
	}
}

func TestCredsBaseURLOverridesDefault(t *testing.T) {
	c := &connector{id: "openai", dialect: core.DialectOpenAI, defaultBase: "https://api.openai.com/v1"}
	got := c.endpoint(core.Credentials{BaseURL: "https://proxy.internal/openai/"})
	if got != "https://proxy.internal/openai/chat/completions" {
		t.Errorf("endpoint = %q", got)
	}
}

func TestForUnknownDialect(t *testing.T) {
	reg := newTestRegistry(t)
	if _, err := reg.For("mystery", core.Dialect("gemini"), "https://x"); err == nil {
		t.Fatal("For accepted an unknown dialect")
	}
}

func TestForCachesByProviderDialectBase(t *testing.T) {
	reg := newTestRegistry(t)
	a, err := reg.For("openai", core.DialectOpenAI, "https://a.example")
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	b, _ := reg.For("openai", core.DialectOpenAI, "https://a.example")
	if a != b {
		t.Error("identical provider/dialect/base should return the same connector")
	}
	c, _ := reg.For("openai", core.DialectOpenAI, "https://b.example")
	if a == c {
		t.Error("a different base URL must not reuse the connector")
	}
	d, _ := reg.For("other", core.DialectOpenAI, "https://a.example")
	if a == d {
		t.Error("a different provider id must not reuse the connector")
	}
}

func TestExtractErrorMessageShapes(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{"nested message", `{"error":{"message":"boom","type":"invalid_request_error"}}`, "boom"},
		{"nested type only", `{"error":{"type":"overloaded_error"}}`, "overloaded_error"},
		{"error as string", `{"error":"plain failure"}`, "plain failure"},
		{"top-level message", `{"message":"top level"}`, "top level"},
		{"non json", `gateway timeout`, "gateway timeout"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := extractErrorMessage([]byte(tc.body)); got != tc.want {
				t.Errorf("extractErrorMessage = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractErrorMessageTruncates(t *testing.T) {
	body := `{"error":{"message":"` + strings.Repeat("x", 900) + `"}}`
	got := extractErrorMessage([]byte(body))
	if len(got) > errorMessageLimit+len("...") {
		t.Errorf("message length = %d, want <= %d", len(got), errorMessageLimit+3)
	}
	if !strings.HasSuffix(got, "...") {
		t.Errorf("truncated message should end in ..., got %q", got[len(got)-10:])
	}
}

func TestAggregateBuildsResponse(t *testing.T) {
	cl := call{provider: "codex", model: "gpt-5-codex", accountID: "acct"}
	chunks := []core.StreamChunk{
		{Type: core.ChunkThinking, Delta: "hmm"},
		{Type: core.ChunkText, Delta: "Hel"},
		{Type: core.ChunkText, Delta: "lo"},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_1", Name: "lookup"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"q":"x"}`)}},
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 5, CompletionTokens: 6, TotalTokens: 11}},
		{Type: core.ChunkFinish, FinishReason: core.FinishStop},
	}

	resp, err := cl.aggregate("gpt-5-codex", chunks)
	if err != nil {
		t.Fatalf("aggregate: %v", err)
	}
	if resp.Model != "gpt-5-codex" || resp.Message.Role != core.RoleAssistant {
		t.Errorf("resp = %+v", resp)
	}
	if got := resp.Message.TextContent(); got != "Hello" {
		t.Errorf("text = %q", got)
	}
	if resp.Usage.TotalTokens != 11 {
		t.Errorf("usage = %+v", resp.Usage)
	}
	// Tool calls imply a tool_calls finish even when the upstream said stop.
	if resp.FinishReason != core.FinishToolCalls {
		t.Errorf("finish = %q, want tool_calls", resp.FinishReason)
	}
	var foundThinking, foundCall bool
	for _, p := range resp.Message.Content {
		switch p.Type {
		case core.PartThinking:
			foundThinking = p.Text == "hmm"
		case core.PartToolCall:
			foundCall = p.ToolCall.ID == "call_1" && p.ToolCall.Name == "lookup" &&
				string(p.ToolCall.Arguments) == `{"q":"x"}`
		}
	}
	if !foundThinking {
		t.Error("thinking part missing from aggregation")
	}
	if !foundCall {
		t.Error("tool call part missing or malformed in aggregation")
	}
}

func TestAggregateErrors(t *testing.T) {
	cl := call{provider: "codex", model: "m"}

	if _, err := cl.aggregate("m", nil); core.AsProviderError(err).Kind != core.ErrEmptyResponse {
		t.Errorf("empty stream kind = %q, want %q", core.AsProviderError(err).Kind, core.ErrEmptyResponse)
	}

	upstream := &core.ProviderError{Kind: core.ErrRateLimit, Message: "slow down"}
	_, err := cl.aggregate("m", []core.StreamChunk{{Type: core.ChunkError, Err: upstream}})
	pe := core.AsProviderError(err)
	if pe.Kind != core.ErrRateLimit {
		t.Errorf("kind = %q, want %q", pe.Kind, core.ErrRateLimit)
	}
	if pe.Provider != "codex" || pe.Model != "m" {
		t.Errorf("identity = %q/%q, want codex/m", pe.Provider, pe.Model)
	}
}

func TestCodexChatUsesStream(t *testing.T) {
	var got capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.record(r)
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "event: response.output_text.delta\n")
		io.WriteString(w, "data: {\"type\":\"response.output_text.delta\",\"delta\":\"streamed answer\"}\n\n")
		io.WriteString(w, "event: response.completed\n")
		io.WriteString(w, "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"status\":\"completed\",\"usage\":{\"input_tokens\":2,\"output_tokens\":3,\"total_tokens\":5}}}\n\n")
	}))
	defer srv.Close()

	reg := newTestRegistry(t)
	conn, err := reg.For("codex", core.DialectOpenAIResponses, srv.URL+"/backend-api/codex/responses")
	if err != nil {
		t.Fatalf("For: %v", err)
	}

	resp, err := conn.Chat(context.Background(), &core.ChatRequest{
		Model:    "gpt-5-codex",
		Messages: []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}},
	}, core.Credentials{AccessToken: "tok", Headers: map[string]string{"chatgpt-account-id": "acct-9"}})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if got.path != "/backend-api/codex/responses" {
		t.Errorf("path = %q", got.path)
	}
	if stream, _ := got.body["stream"].(bool); !stream {
		t.Errorf("codex requires stream=true, body=%s", got.raw)
	}
	if got.headers.Get("originator") != "codex_cli_rs" {
		t.Errorf("originator = %q", got.headers.Get("originator"))
	}
	if got.headers.Get("chatgpt-account-id") != "acct-9" {
		t.Errorf("chatgpt-account-id = %q", got.headers.Get("chatgpt-account-id"))
	}
	if got := resp.Message.TextContent(); got != "streamed answer" {
		t.Errorf("text = %q, want %q", got, "streamed answer")
	}
}

func TestCodexOmitsAccountIDHeaderWhenAbsent(t *testing.T) {
	c := &connector{id: "codex", dialect: core.DialectOpenAIResponses}
	h := c.headers(core.Credentials{AccessToken: "tok"})
	if _, ok := h["chatgpt-account-id"]; ok {
		t.Error("chatgpt-account-id must be omitted when the credential has none")
	}
	if h["originator"] != "codex_cli_rs" {
		t.Errorf("originator = %q", h["originator"])
	}
}

func TestEmptyTokenSendsNoAuthHeader(t *testing.T) {
	c := &connector{id: "vllm", dialect: core.DialectOpenAI}
	if h := c.headers(core.Credentials{}); h["Authorization"] != "" {
		t.Errorf("Authorization = %q, want empty for an AuthNone provider", h["Authorization"])
	}
}

func TestJoinURL(t *testing.T) {
	cases := []struct{ base, path, want string }{
		{"https://a/v1", "chat/completions", "https://a/v1/chat/completions"},
		{"https://a/v1/", "/chat/completions", "https://a/v1/chat/completions"},
		{"https://a", "responses", "https://a/responses"},
	}
	for _, tc := range cases {
		if got := joinURL(tc.base, tc.path); got != tc.want {
			t.Errorf("joinURL(%q,%q) = %q, want %q", tc.base, tc.path, got, tc.want)
		}
	}
}

func TestTransportErrorTimeoutClassification(t *testing.T) {
	cl := call{provider: "openai", model: "m", accountID: "a"}

	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	pe := cl.transport(ctx, context.DeadlineExceeded)
	if pe.Kind != core.ErrTimeout {
		t.Errorf("deadline kind = %q, want %q", pe.Kind, core.ErrTimeout)
	}
	if pe.AccountID != "a" || pe.Provider != "openai" {
		t.Errorf("identity = %q/%q", pe.Provider, pe.AccountID)
	}

	pe = cl.transport(context.Background(), errors.New("dial tcp: connection refused"))
	if pe.Kind != core.ErrUpstream {
		t.Errorf("transport kind = %q, want %q", pe.Kind, core.ErrUpstream)
	}
}

func TestContextCancelStopsStream(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.(http.Flusher).Flush()
		<-release
	}))
	defer srv.Close()
	defer close(release)

	reg := newTestRegistry(t)
	conn, _ := reg.For("openai", core.DialectOpenAI, srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	ch, err := conn.Stream(ctx, testRequest(), core.Credentials{APIKey: "k"}, core.StreamConfig{})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}
	cancel()

	done := make(chan struct{})
	go func() {
		for range ch {
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("stream channel did not close after context cancellation")
	}
}

// drain collects every chunk from a stream channel.
func drain(t *testing.T, ch <-chan core.StreamChunk) []core.StreamChunk {
	t.Helper()
	var out []core.StreamChunk
	timeout := time.After(5 * time.Second)
	for {
		select {
		case c, ok := <-ch:
			if !ok {
				return out
			}
			out = append(out, c)
		case <-timeout:
			t.Fatal("timed out draining stream channel")
		}
	}
}
