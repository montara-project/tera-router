package connectors

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

// buddyTestRequest is a canonical request with a caller system prompt, one
// user turn and a tool definition.
func buddyTestRequest(model string) *core.ChatRequest {
	return &core.ChatRequest{
		Model:  model,
		System: "You are Claude Code, Anthropic's official CLI for Claude.",
		Messages: []core.Message{
			{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "write a function"}}},
		},
		Tools: []core.Tool{{Name: "read_file", Parameters: json.RawMessage(`{"type":"object"}`)}},
		Reasoning: &core.ReasoningConfig{
			Effort:    "high",
			MaxTokens: 4096,
		},
	}
}

// TestBuddyHeaders pins the client fingerprint per realm and the identity
// layering: the conversation id is stable, the turn id is stable across
// retries of one turn, and the attempt ids are fresh each call.
func TestBuddyHeaders(t *testing.T) {
	creds := core.Credentials{AccountID: "acc-1", AccessToken: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1LTEifQ.sig"}
	req := buddyTestRequest("glm-5.2")
	req.Metadata = core.RequestMetadata{APIKeyID: "key-1", ClientIP: "203.0.113.9"}

	cases := map[string]struct {
		domain, ide, version, userAgent string
	}{
		"workbuddy":    {domain: "www.workbuddy.ai", ide: "WorkBuddy", version: "5.9.4", userAgent: "WorkBuddy/5.9.4 WorkBuddy/5.9.4"},
		"codebuddy":    {domain: "www.codebuddy.ai", ide: "CLI", version: "2.180.0", userAgent: "CLI/2.180.0 CodeBuddy/2.180.0"},
		"codebuddy-cn": {domain: "copilot.tencent.com", ide: "CLI", version: "2.180.0", userAgent: "CLI/2.180.0 CodeBuddy/2.180.0"},
	}
	for slug, want := range cases {
		h := BuddyHeaders(slug, creds, req, req.Model)
		if h["X-Domain"] != want.domain {
			t.Errorf("%s X-Domain = %q, want %q", slug, h["X-Domain"], want.domain)
		}
		if h["X-IDE-Type"] != want.ide || h["X-IDE-Name"] != want.ide {
			t.Errorf("%s IDE identity = %q/%q, want %s", slug, h["X-IDE-Type"], h["X-IDE-Name"], want.ide)
		}
		if h["X-IDE-Version"] != want.version {
			t.Errorf("%s X-IDE-Version = %q, want %q", slug, h["X-IDE-Version"], want.version)
		}
		if h["User-Agent"] != want.userAgent {
			t.Errorf("%s User-Agent = %q, want %q", slug, h["User-Agent"], want.userAgent)
		}
		if h["X-Product"] != "SaaS" || h["X-Agent-Intent"] != "craft" {
			t.Errorf("%s product/agent = %q/%q", slug, h["X-Product"], h["X-Agent-Intent"])
		}
		if h["Authorization"] != "Bearer "+creds.AccessToken {
			t.Errorf("%s Authorization = %q", slug, h["Authorization"])
		}
		// A session JWT must never ride as X-API-Key: the gateway would look it
		// up in the API-key table and answer 401 not_found.
		if _, set := h["X-API-Key"]; set {
			t.Errorf("%s sent a JWT as X-API-Key", slug)
		}
		if h["X-User-Id"] != "u-1" {
			t.Errorf("%s X-User-Id = %q, want the JWT subject", slug, h["X-User-Id"])
		}
	}
}

// TestBuddyIdentityLayering pins the id lifetimes: the conversation id ignores
// the content, the turn id ignores the attempt, and two different turns differ.
func TestBuddyIdentityLayering(t *testing.T) {
	creds := core.Credentials{AccountID: "acc-1", APIKey: "sk-buddy-key"}
	req := buddyTestRequest("glm-5.2")

	first := BuddyHeaders("codebuddy", creds, req, req.Model)
	second := BuddyHeaders("codebuddy", creds, req, req.Model)

	if first["X-Conversation-ID"] != second["X-Conversation-ID"] {
		t.Error("the conversation id changed between two calls of one account")
	}
	if first["X-Conversation-Request-ID"] != second["X-Conversation-Request-ID"] {
		t.Error("the turn id changed between two retries of one turn")
	}
	if first["X-Request-ID"] == second["X-Request-ID"] {
		t.Error("two attempts shared one X-Request-ID")
	}
	if first["X-Conversation-Message-ID"] == second["X-Conversation-Message-ID"] {
		t.Error("two attempts shared one message id")
	}

	// A different caller on the same account is a different conversation.
	other := buddyTestRequest("glm-5.2")
	other.Metadata = core.RequestMetadata{APIKeyID: "key-2"}
	next := BuddyHeaders("codebuddy", creds, other, other.Model)
	if next["X-Conversation-ID"] == first["X-Conversation-ID"] {
		t.Error("two callers of one account shared a conversation id")
	}

	// A new user turn is a new turn id.
	turned := buddyTestRequest("glm-5.2")
	turned.Messages = append(turned.Messages, core.Message{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "and a test"}}})
	third := BuddyHeaders("codebuddy", creds, turned, turned.Model)
	if third["X-Conversation-Request-ID"] == first["X-Conversation-Request-ID"] {
		t.Error("two different turns shared one turn id")
	}
	if third["X-Conversation-ID"] != first["X-Conversation-ID"] {
		t.Error("a follow-up turn started a new conversation")
	}

	// An API key is a real key, so it rides both as Bearer and X-API-Key.
	if first["X-API-Key"] != "sk-buddy-key" {
		t.Errorf("X-API-Key = %q, want the key mirrored", first["X-API-Key"])
	}
}

// TestBuddyShapeRequest pins the request reshaping: a neutral system prompt
// with the caller's instructions folded into the first user turn, no tool lane
// for glm-5.2, and reasoning only as the flat effort knob.
func TestBuddyShapeRequest(t *testing.T) {
	req := buddyTestRequest("glm-5.2")
	rendered, err := transform.OpenAICodec{}.RenderRequest(req, "codebuddy")
	if err != nil {
		t.Fatal(err)
	}
	body, err := buddyShapeRequest(rendered, req, "codebuddy")
	if err != nil {
		t.Fatalf("shape: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	if _, set := out["system"]; set {
		t.Error("the body still carries a top-level system field")
	}
	if _, set := out["tools"]; set {
		t.Error("glm-5.2 kept its tool definitions")
	}
	if _, set := out["tool_choice"]; set {
		t.Error("glm-5.2 kept its tool_choice")
	}
	if _, set := out["reasoning"]; set {
		t.Error("the body still carries a reasoning object")
	}
	if out["reasoning_effort"] != "high" {
		t.Errorf("reasoning_effort = %v, want high", out["reasoning_effort"])
	}

	messages, _ := out["messages"].([]any)
	if len(messages) < 2 {
		t.Fatalf("messages = %d, want a system turn and a user turn", len(messages))
	}
	first, _ := messages[0].(map[string]any)
	if first["role"] != "system" || first["content"] != BuddyNeutralSystem {
		t.Errorf("first message = %+v, want the neutral system turn", first)
	}
	second, _ := messages[1].(map[string]any)
	content, _ := second["content"].(string)
	if !strings.Contains(content, "<client_instructions>") || !strings.Contains(content, "official CLI for Claude") {
		t.Errorf("first user turn = %q, want the caller's system prompt folded in", content)
	}
	if !strings.Contains(content, "write a function") {
		t.Errorf("first user turn = %q, want the original user text kept", content)
	}
}

// TestBuddyShapeRequestKeepsToolsForOtherModels pins that only glm-5.2 loses
// its tool lane: every other model keeps the caller's tools.
func TestBuddyShapeRequestKeepsToolsForOtherModels(t *testing.T) {
	req := buddyTestRequest("claude-sonnet-4")
	rendered, err := transform.OpenAICodec{}.RenderRequest(req, "codebuddy")
	if err != nil {
		t.Fatal(err)
	}
	body, err := buddyShapeRequest(rendered, req, "codebuddy")
	if err != nil {
		t.Fatalf("shape: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	if _, set := out["tools"]; !set {
		t.Error("a non-glm model lost its tool definitions")
	}
}

// TestBuddyStatusClassification pins the two gateway refusals: 11128 is a
// transient upstream fault, 11140 an account restriction — neither is a bad
// credential.
func TestBuddyStatusClassification(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		want   core.ErrorKind
	}{
		{
			name:   "channel refusal",
			status: 400,
			body:   `{"code": 11128, "msg": "Illegal API invocation from an unapproved channel", "error": "request illegal failed channel verification"}`,
			want:   core.ErrUpstream,
		},
		{
			name:   "account restriction",
			status: 403,
			body:   `{"code": 11140, "msg": "account has been restricted due to unusual activity"}`,
			want:   core.ErrUpstream,
		},
		{
			name:   "plain 400 is still a bad request",
			status: 400,
			body:   `{"code": 11101, "msg": "Parse message failed"}`,
			want:   core.ErrBadRequest,
		},
		{
			name:   "plain 403 is still an auth failure",
			status: 403,
			body:   `{"message":"token expired"}`,
			want:   core.ErrAuth,
		},
	}
	for _, tc := range cases {
		resp := &http.Response{StatusCode: tc.status, Header: http.Header{}}
		buddyCall := call{provider: "codebuddy"}
		got := buddyCall.status(resp, []byte(tc.body)).Kind
		if got != tc.want {
			t.Errorf("%s: kind = %s, want %s", tc.name, got, tc.want)
		}
	}

	// The same bodies from another provider keep the status-derived kind: the
	// codes are buddy-specific, not a global heuristic.
	resp := &http.Response{StatusCode: 400, Header: http.Header{}}
	body := []byte(`{"code": 11128, "msg": "Illegal API invocation from an unapproved channel"}`)
	openaiCall := call{provider: "openai"}
	if got := openaiCall.status(resp, body).Kind; got != core.ErrBadRequest {
		t.Errorf("a 11128 body from openai = %s, want bad_request", got)
	}
}

// TestBuddyEndpoint pins the chat URL per realm: the gateway lives under /v2,
// so a catalog base that already carries it must not gain a second one, and an
// account override pointing at the bare host must gain it.
func TestBuddyEndpoint(t *testing.T) {
	cases := []struct {
		slug, base, override, want string
	}{
		{slug: "workbuddy", base: "https://www.workbuddy.ai/v2", want: "https://www.workbuddy.ai/v2/chat/completions"},
		{slug: "codebuddy", base: "https://www.codebuddy.ai/v2", want: "https://www.codebuddy.ai/v2/chat/completions"},
		{slug: "codebuddy-cn", base: "https://copilot.tencent.com/v2", want: "https://copilot.tencent.com/v2/chat/completions"},
		{slug: "codebuddy", base: "https://www.codebuddy.ai/v2", override: "https://proxy.example/cb", want: "https://proxy.example/cb/v2/chat/completions"},
	}
	for _, tc := range cases {
		c := &connector{id: tc.slug, dialect: core.DialectOpenAI, defaultBase: tc.base}
		creds := core.Credentials{BaseURL: tc.override}
		if got := c.endpoint(creds); got != tc.want {
			t.Errorf("%s endpoint = %q, want %q", tc.slug, got, tc.want)
		}
	}
}

// TestBuddyCNRequestsSummary pins the CN reasoning quirk: a request without an
// explicit effort asks for the summary the realm needs to emit its deltas.
func TestBuddyCNRequestsSummary(t *testing.T) {
	req := &core.ChatRequest{Model: "glm-5.2", Messages: []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}}}
	rendered, err := transform.OpenAICodec{}.RenderRequest(req, "codebuddy-cn")
	if err != nil {
		t.Fatal(err)
	}
	body, err := buddyShapeRequest(rendered, req, "codebuddy-cn")
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	if out["reasoning_effort"] != "medium" || out["reasoning_summary"] != "auto" {
		t.Errorf("cn default reasoning = %v/%v, want medium/auto", out["reasoning_effort"], out["reasoning_summary"])
	}
}
