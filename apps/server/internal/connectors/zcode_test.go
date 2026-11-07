package connectors

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

// The ZCode plan lane byte-compares the canonical system prefixes and rejects
// requests that do not carry them with 405 {"code":3012}, so the identity
// asset must be intact and the shaping must build the exact three-block form.
func TestZcodeIdentityAsset(t *testing.T) {
	id := zcodeIdentityData()
	if !strings.HasPrefix(id.CliPrefix, "You are ZCode") {
		t.Errorf("cli prefix = %q", id.CliPrefix)
	}
	if len(id.StablePrefix) < 1500 {
		t.Errorf("stable prefix too short: %d", len(id.StablePrefix))
	}
	if id.AnthropicVersion == "" || id.AnthropicBeta == "" {
		t.Errorf("anthropic headers missing: %q %q", id.AnthropicVersion, id.AnthropicBeta)
	}
}

func TestZcodeHeaders(t *testing.T) {
	id := zcodeIdentityData()
	creds := core.Credentials{AccountID: "acc-1", AccessToken: "tok"}
	h := ZCodeHeaders("tok", creds, nil)
	if h["Authorization"] != "Bearer tok" {
		t.Errorf("authorization = %q", h["Authorization"])
	}
	if h["anthropic-version"] != id.AnthropicVersion {
		t.Errorf("anthropic-version = %q", h["anthropic-version"])
	}
	if h["anthropic-beta"] != id.AnthropicBeta {
		t.Errorf("anthropic-beta = %q", h["anthropic-beta"])
	}
	if h["user-agent"] != id.SDKUserAgent {
		t.Errorf("user-agent = %q", h["user-agent"])
	}
	for _, k := range []string{"x-zcode-agent", "x-zcode-app-version", "x-zcode-session-type", "x-zcode-query-source"} {
		if h[k] == "" {
			t.Errorf("header %q empty", k)
		}
	}
}

// TestZcodeCorrelationHeaders pins the per-request correlation headers the
// desktop client always sends: a stable session id per caller (bare id — the
// official client strips its internal "sess_" prefix), and fresh
// request/trace/query ids per attempt (the query id derives from the request
// id, mirroring the official client).
func TestZcodeCorrelationHeaders(t *testing.T) {
	creds := core.Credentials{AccountID: "acc-1", AccessToken: "tok"}
	first := ZCodeHeaders("tok", creds, nil)

	if sid := first["x-session-id"]; len(sid) != 32 || strings.Trim(strings.ToLower(sid), "0123456789abcdef") != "" {
		t.Errorf("x-session-id = %q, want 32 lowercase hex chars (bare id, no prefix)", sid)
	}
	if second := ZCodeHeaders("tok", creds, nil); second["x-session-id"] != first["x-session-id"] {
		t.Error("x-session-id must be stable for the same caller")
	}
	if second := ZCodeHeaders("tok", creds, nil); second["x-request-id"] == first["x-request-id"] {
		t.Error("x-request-id must be fresh per attempt")
	}
	if first["x-query-id"] != "01a1"+first["x-request-id"][4:] {
		t.Errorf("x-query-id = %q, want 01a1 + request id suffix", first["x-query-id"])
	}
	for _, k := range []string{"x-request-id", "x-zcode-trace-id"} {
		if v := first[k]; len(v) != 36 || v[14] != '4' {
			t.Errorf("%s = %q, want a v4-shaped uuid", k, v)
		}
	}
}

// TestZcodeChatShape drives a full Chat through a provider registered as
// zcode and checks the wire body: system blocks, metadata.user_id,
// max_tokens, and the effort-form thinking field.
func TestZcodeChatShape(t *testing.T) {
	var raw []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ = io.ReadAll(r.Body)
		io.WriteString(w, `{"id":"msg_1","model":"glm-5.3","role":"assistant","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer srv.Close()

	conn, err := newTestRegistry(t).For("zcode", core.DialectAnthropic, srv.URL)
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	req := testRequest()
	req.Model = "glm-5.3"
	req.System = "Be brief."
	req.Reasoning = &core.ReasoningConfig{Effort: "high"}
	creds := core.Credentials{AccessToken: "plan-jwt"}
	if _, err := conn.Chat(context.Background(), req, creds); err != nil {
		t.Fatalf("Chat: %v", err)
	}

	var body struct {
		System []struct {
			Text         string `json:"text"`
			CacheControl *struct {
				Type string `json:"type"`
			} `json:"cache_control"`
		} `json:"system"`
		Metadata struct {
			UserID string `json:"user_id"`
		} `json:"metadata"`
		MaxTokens int `json:"max_tokens"`
		Thinking  *struct {
			Type string `json:"type"`
		} `json:"thinking"`
		OutputConfig *struct {
			Effort string `json:"effort"`
		} `json:"output_config"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("parse body: %v\n%s", err, raw)
	}

	id := zcodeIdentityData()
	if len(body.System) != 3 {
		t.Fatalf("system blocks = %d, want 3", len(body.System))
	}
	if body.System[0].Text != id.CliPrefix || body.System[1].Text != id.StablePrefix {
		t.Error("identity blocks 1/2 must carry the canonical prefixes verbatim")
	}
	if body.System[1].CacheControl == nil || body.System[2].CacheControl == nil {
		t.Error("blocks 2/3 must be cache_control ephemeral")
	}
	if body.System[2].Text != "\n\nBe brief." {
		t.Errorf("client system block = %q, want the caller's prompt in block 3", body.System[2].Text)
	}
	var meta map[string]any
	if err := json.Unmarshal([]byte(body.Metadata.UserID), &meta); err != nil {
		t.Fatalf("metadata.user_id not JSON: %v", err)
	}
	for _, k := range []string{"device_id", "account_uuid", "session_id"} {
		if v, _ := meta[k].(string); v == "" {
			t.Errorf("metadata.user_id missing %q: %s", k, body.Metadata.UserID)
		}
	}
	if body.MaxTokens <= 0 {
		t.Errorf("max_tokens = %d, want the 8192 default", body.MaxTokens)
	}
	// Official mapping: adaptive thinking with the effort level in
	// output_config, never budget_tokens.
	if body.Thinking == nil || body.Thinking.Type != "adaptive" {
		t.Errorf("thinking = %+v, want {adaptive}", body.Thinking)
	}
	if body.OutputConfig == nil || body.OutputConfig.Effort != "high" {
		t.Errorf("output_config = %+v, want {effort: high}", body.OutputConfig)
	}
	if req.SystemPreamble != "" {
		t.Error("zcode must not inject the Claude Code preamble")
	}
	if strings.Contains(string(raw), "budget_tokens") {
		t.Error("thinking must be effort-shaped, not budget_tokens")
	}
}

// TestZcodeChatShapeNoReasoning pins the disabled-thinking form the official
// client sends when the model rule's reasoning level is "disabled".
func TestZcodeChatShapeNoReasoning(t *testing.T) {
	var raw []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ = io.ReadAll(r.Body)
		io.WriteString(w, `{"id":"msg_1","model":"glm-5.3-flash","role":"assistant","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer srv.Close()

	conn, err := newTestRegistry(t).For("zcode", core.DialectAnthropic, srv.URL)
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	req := testRequest()
	req.Model = "glm-5.3-flash"
	if _, err := conn.Chat(context.Background(), req, core.Credentials{AccessToken: "plan-jwt"}); err != nil {
		t.Fatalf("Chat: %v", err)
	}

	var body struct {
		Thinking     *struct{ Type string }   `json:"thinking"`
		OutputConfig *struct{ Effort string } `json:"output_config"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("parse body: %v", err)
	}
	if body.Thinking == nil || body.Thinking.Type != "disabled" {
		t.Errorf("thinking = %+v, want {disabled}", body.Thinking)
	}
	if body.OutputConfig != nil {
		t.Errorf("output_config = %+v, want absent without reasoning", body.OutputConfig)
	}
}

// TestZcodeEndpointJoin pins the plan-lane URL: the catalog base already ends
// at the anthropic mount, so the connector appends "messages".
func TestZcodeEndpointJoin(t *testing.T) {
	c := &connector{id: "zcode", dialect: core.DialectAnthropic}
	got := c.endpoint(core.Credentials{})
	if got != "messages" || !strings.HasSuffix(got, "messages") {
		// joinURL with an empty base yields "messages" — pin the join logic
		// with the real catalog base instead.
		c2 := &connector{id: "zcode", dialect: core.DialectAnthropic, defaultBase: "https://zcode.z.ai/api/v1/zcode-plan/anthropic"}
		if got := c2.endpoint(core.Credentials{}); got != "https://zcode.z.ai/api/v1/zcode-plan/anthropic/messages" {
			t.Errorf("endpoint = %q", got)
		}
	}
}

func TestZcodeEffortMapping(t *testing.T) {
	cases := []struct {
		effort string
		max    int
		want   string
	}{
		{"low", 0, "low"},
		{"medium", 0, "high"},
		{"high", 0, "high"},
		{"xhigh", 0, "max"},
		{"", 0, ""},
		{"", 1024, "low"},
		{"", 8192, "high"},
		{"", 32768, "max"},
	}
	for _, tc := range cases {
		req := &core.ChatRequest{}
		if tc.effort != "" || tc.max > 0 {
			req.Reasoning = &core.ReasoningConfig{Effort: tc.effort, MaxTokens: tc.max}
		}
		if got := zcodeEffort(req); got != tc.want {
			t.Errorf("effort(%q, %d) = %q, want %q", tc.effort, tc.max, got, tc.want)
		}
	}
	if zcodeEffort(nil) != "" {
		t.Error("nil request must map to no effort")
	}
}

func TestZcodeStableUUIDShape(t *testing.T) {
	a := zcodeStableUUID("device:acc-1")
	b := zcodeStableUUID("device:acc-1")
	if a != b {
		t.Error("stable uuid must be deterministic")
	}
	if len(a) != 36 || a[14] != '4' {
		t.Errorf("uuid = %q, want a v4-shaped string", a)
	}
}
