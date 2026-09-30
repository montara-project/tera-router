package transform

import (
	"encoding/json"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

// ---- helpers ----------------------------------------------------------------

func antTestMsg(role core.Role, parts ...core.ContentPart) core.Message {
	return core.Message{Role: role, Content: parts}
}

func antText(s string) core.ContentPart { return core.ContentPart{Type: core.PartText, Text: s} }

// antParseEvents splits rendered SSE bytes into (event name, data) pairs.
func antParseEvents(t *testing.T, raw []byte) []struct {
	Name string
	Data map[string]any
} {
	t.Helper()
	var out []struct {
		Name string
		Data map[string]any
	}
	for _, chunk := range strings.Split(string(raw), "\n\n") {
		chunk = strings.TrimSpace(chunk)
		if chunk == "" {
			continue
		}
		var name string
		var data string
		for _, line := range strings.Split(chunk, "\n") {
			switch {
			case strings.HasPrefix(line, "event: "):
				name = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "data: "):
				data = strings.TrimPrefix(line, "data: ")
			}
		}
		var payload map[string]any
		if err := json.Unmarshal([]byte(data), &payload); err != nil {
			t.Fatalf("event %q: bad data %q: %v", name, data, err)
		}
		out = append(out, struct {
			Name string
			Data map[string]any
		}{name, payload})
	}
	return out
}

func antEventNames(events []struct {
	Name string
	Data map[string]any
}) []string {
	names := make([]string, len(events))
	for i, e := range events {
		names[i] = e.Name
	}
	return names
}

func antMustRender(t *testing.T, req *core.ChatRequest) map[string]any {
	t.Helper()
	body, err := AnthropicCodec{}.RenderRequest(req, "")
	if err != nil {
		t.Fatalf("RenderRequest: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("rendered body is not JSON: %v", err)
	}
	return out
}

func antMessageBlocks(t *testing.T, rendered map[string]any, index int) []map[string]any {
	t.Helper()
	msgs, ok := rendered["messages"].([]any)
	if !ok {
		t.Fatalf("rendered messages missing: %v", rendered)
	}
	if index >= len(msgs) {
		t.Fatalf("message %d missing (have %d)", index, len(msgs))
	}
	m := msgs[index].(map[string]any)
	blocks, ok := m["content"].([]any)
	if !ok {
		t.Fatalf("message %d has no content blocks: %v", index, m)
	}
	out := make([]map[string]any, len(blocks))
	for i, b := range blocks {
		out[i] = b.(map[string]any)
	}
	return out
}

func antMessageRole(t *testing.T, rendered map[string]any, index int) string {
	t.Helper()
	msgs := rendered["messages"].([]any)
	return msgs[index].(map[string]any)["role"].(string)
}

// ---- ParseRequest -----------------------------------------------------------

// TestAnthropicParseRequest_ToolResultSplitsMessages covers the contract's
// Anthropic-specific rule: a user turn carrying tool_result blocks becomes a
// RoleTool message, and any remaining text/image blocks follow as RoleUser.
func TestAnthropicParseRequest_ToolResultSplitsMessages(t *testing.T) {
	body := []byte(`{
		"model": "claude-sonnet-4",
		"max_tokens": 1024,
		"stream": true,
		"system": [{"type":"text","text":"be brief"},{"type":"text","text":" and kind"}],
		"temperature": 0.3,
		"top_p": 0.9,
		"stop_sequences": ["STOP"],
		"metadata": {"user_id": "u1"},
		"top_k": 40,
		"thinking": {"type": "enabled", "budget_tokens": 2048},
		"tools": [{"name":"get_weather","description":"w","input_schema":{"type":"object","properties":{"city":{"type":"string"}}}}],
		"tool_choice": {"type":"tool","name":"get_weather"},
		"messages": [
			{"role":"user","content":"hello"},
			{"role":"assistant","content":[
				{"type":"thinking","thinking":"hmm","signature":"sig-1"},
				{"type":"text","text":"calling"},
				{"type":"tool_use","id":"toolu_1","name":"get_weather","input":{"city":"Paris"}}
			]},
			{"role":"user","content":[
				{"type":"tool_result","tool_use_id":"toolu_1","content":[{"type":"text","text":"sunny"}],"is_error":true},
				{"type":"tool_result","tool_use_id":"toolu_2","content":"rainy"},
				{"type":"text","text":"thanks"}
			]}
		]
	}`)

	req, err := AnthropicCodec{}.ParseRequest(body)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}

	if req.Model != "claude-sonnet-4" {
		t.Errorf("model = %q", req.Model)
	}
	if req.System != "be brief and kind" {
		t.Errorf("system = %q, want text blocks joined", req.System)
	}
	if req.MaxTokens == nil || *req.MaxTokens != 1024 {
		t.Errorf("max_tokens = %v", req.MaxTokens)
	}
	if !req.Stream {
		t.Error("stream not parsed")
	}
	if req.Temperature == nil || *req.Temperature != 0.3 {
		t.Errorf("temperature = %v", req.Temperature)
	}
	if req.TopP == nil || *req.TopP != 0.9 {
		t.Errorf("top_p = %v", req.TopP)
	}
	if len(req.Stop) != 1 || req.Stop[0] != "STOP" {
		t.Errorf("stop = %v", req.Stop)
	}
	if req.Reasoning == nil || req.Reasoning.MaxTokens != 2048 {
		t.Fatalf("reasoning = %+v, want budget 2048", req.Reasoning)
	}
	if req.ToolChoice == nil || req.ToolChoice.Mode != "function" || req.ToolChoice.Name != "get_weather" {
		t.Errorf("tool_choice = %+v", req.ToolChoice)
	}
	if len(req.Tools) != 1 || req.Tools[0].Name != "get_weather" {
		t.Fatalf("tools = %+v", req.Tools)
	}
	if _, ok := req.Extra["metadata"]; !ok {
		t.Error("metadata not preserved in Extra")
	}
	if _, ok := req.Extra["top_k"]; !ok {
		t.Error("top_k not preserved in Extra")
	}

	if len(req.Messages) != 4 {
		t.Fatalf("got %d messages, want 4 (user, assistant, tool, user)", len(req.Messages))
	}
	if req.Messages[0].Role != core.RoleUser || req.Messages[0].Content[0].Text != "hello" {
		t.Errorf("msg0 = %+v", req.Messages[0])
	}

	assistant := req.Messages[1]
	if assistant.Role != core.RoleAssistant || len(assistant.Content) != 3 {
		t.Fatalf("assistant = %+v", assistant)
	}
	if assistant.Content[0].Type != core.PartThinking || assistant.Content[0].Signature != "sig-1" {
		t.Errorf("thinking part = %+v", assistant.Content[0])
	}
	if assistant.Content[2].Type != core.PartToolCall ||
		assistant.Content[2].ToolCall.Name != "get_weather" ||
		string(assistant.Content[2].ToolCall.Arguments) != `{"city":"Paris"}` {
		t.Errorf("tool_use part = %+v", assistant.Content[2])
	}

	tool := req.Messages[2]
	if tool.Role != core.RoleTool || len(tool.Content) != 2 {
		t.Fatalf("tool message = %+v", tool)
	}
	if tr := tool.Content[0].ToolResult; tr.CallID != "toolu_1" || tr.Content != "sunny" || !tr.IsError {
		t.Errorf("tool result 0 = %+v", tr)
	}
	if tr := tool.Content[1].ToolResult; tr.CallID != "toolu_2" || tr.Content != "rainy" || tr.IsError {
		t.Errorf("tool result 1 = %+v", tr)
	}

	tail := req.Messages[3]
	if tail.Role != core.RoleUser || len(tail.Content) != 1 || tail.Content[0].Text != "thanks" {
		t.Errorf("trailing user message = %+v", tail)
	}
}

// TestAnthropicParseRequest_ImagesAndToolChoiceModes covers image sources
// (base64 and url), the auto/any/none tool_choice mappings, and a string system.
func TestAnthropicParseRequest_ImagesAndToolChoiceModes(t *testing.T) {
	body := []byte(`{
		"model": "claude-sonnet-4",
		"system": "sys",
		"tool_choice": {"type":"any"},
		"messages": [{"role":"user","content":[
			{"type":"image","source":{"type":"base64","media_type":"image/png","data":"AAA"}},
			{"type":"image","source":{"type":"url","url":"https://x/y.png"}}
		]}]
	}`)
	req, err := AnthropicCodec{}.ParseRequest(body)
	if err != nil {
		t.Fatalf("ParseRequest: %v", err)
	}
	if req.System != "sys" {
		t.Errorf("system = %q", req.System)
	}
	if req.ToolChoice == nil || req.ToolChoice.Mode != "required" {
		t.Errorf("tool_choice(any) = %+v", req.ToolChoice)
	}
	parts := req.Messages[0].Content
	if len(parts) != 2 {
		t.Fatalf("parts = %+v", parts)
	}
	if parts[0].Media.MIMEType != "image/png" || parts[0].Media.Data != "AAA" {
		t.Errorf("base64 image = %+v", parts[0].Media)
	}
	if parts[1].Media.URL != "https://x/y.png" || parts[1].Media.Data != "" {
		t.Errorf("url image = %+v", parts[1].Media)
	}

	for _, tc := range []struct {
		wire string
		mode string
		name string
	}{
		{`{"type":"auto"}`, "auto", ""},
		{`{"type":"none"}`, "none", ""},
		{`{"type":"tool","name":"f"}`, "function", "f"},
	} {
		req, err := AnthropicCodec{}.ParseRequest([]byte(`{"model":"m","tool_choice":` + tc.wire + `,"messages":[{"role":"user","content":"x"}]}`))
		if err != nil {
			t.Fatalf("ParseRequest(%s): %v", tc.wire, err)
		}
		if req.ToolChoice == nil || req.ToolChoice.Mode != tc.mode || req.ToolChoice.Name != tc.name {
			t.Errorf("tool_choice %s => %+v, want mode=%s name=%s", tc.wire, req.ToolChoice, tc.mode, tc.name)
		}
	}
}

// ---- RenderRequest ----------------------------------------------------------

// TestAnthropicRender_MaxTokensDefault pins the Anthropic max_tokens defaulting:
// a client value wins, an unknown model falls back to the floor, a Claude
// family id resolves to its published ceiling, and MaxCompletionTokens is
// accepted as the alternate knob.
func TestAnthropicRender_MaxTokensDefault(t *testing.T) {
	cases := []struct {
		name string
		req  *core.ChatRequest
		want int
	}{
		{
			name: "client value wins",
			req:  &core.ChatRequest{Model: "claude-sonnet-4", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}, MaxTokens: new(1234)},
			want: 1234,
		},
		{
			name: "max_completion_tokens accepted",
			req:  &core.ChatRequest{Model: "claude-sonnet-4", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}, MaxCompletionTokens: new(777)},
			want: 777,
		},
		{
			name: "claude sonnet family ceiling",
			req:  &core.ChatRequest{Model: "claude-sonnet-4-5-20250929", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}},
			want: 64000,
		},
		{
			name: "claude opus family ceiling",
			req:  &core.ChatRequest{Model: "anthropic/claude-opus-4.8", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}},
			want: 32000,
		},
		{
			name: "unknown model floor",
			req:  &core.ChatRequest{Model: "some-unknown-model", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}},
			want: 8192,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := antMustRender(t, tc.req)["max_tokens"]
			if int(got.(float64)) != tc.want {
				t.Errorf("max_tokens = %v, want %d", got, tc.want)
			}
		})
	}
}

// TestAnthropicRender_MergesConsecutiveRoles covers the alternation rule: two
// user turns collapse into one message with concatenated blocks, and a
// conversation that would start with an assistant turn gains a synthetic user
// message.
func TestAnthropicRender_MergesConsecutiveRoles(t *testing.T) {
	req := &core.ChatRequest{
		Model: "claude-sonnet-4",
		Messages: []core.Message{
			antTestMsg(core.RoleAssistant, antText("first")),
			antTestMsg(core.RoleUser, antText("a")),
			antTestMsg(core.RoleUser, antText("b")),
			antTestMsg(core.RoleAssistant, antText("c")),
			antTestMsg(core.RoleAssistant, antText("d")),
		},
	}
	rendered := antMustRender(t, req)

	msgs := rendered["messages"].([]any)
	if len(msgs) != 4 {
		t.Fatalf("got %d messages, want 4 (synthetic user, assistant, user, assistant)", len(msgs))
	}
	if antMessageRole(t, rendered, 0) != "user" {
		t.Error("conversation must be made to start with a user turn")
	}
	if antMessageRole(t, rendered, 1) != "assistant" {
		t.Errorf("msg1 role = %s", antMessageRole(t, rendered, 1))
	}

	blocks := antMessageBlocks(t, rendered, 2)
	if len(blocks) != 2 || blocks[0]["text"] != "a" || blocks[1]["text"] != "b" {
		t.Errorf("merged user blocks = %+v, want a then b", blocks)
	}
	blocks = antMessageBlocks(t, rendered, 3)
	if len(blocks) != 2 || blocks[0]["text"] != "c" || blocks[1]["text"] != "d" {
		t.Errorf("merged assistant blocks = %+v, want c then d", blocks)
	}
}

// TestAnthropicRender_ToolResultBlocks covers canonical RoleTool messages
// rendering as user-message tool_result blocks, and dedup after a merge.
func TestAnthropicRender_ToolResultBlocks(t *testing.T) {
	req := &core.ChatRequest{
		Model: "claude-sonnet-4",
		Messages: []core.Message{
			antTestMsg(core.RoleUser, antText("go")),
			antTestMsg(core.RoleAssistant, core.ContentPart{
				Type:     core.PartToolCall,
				ToolCall: &core.ToolCall{ID: "call_1", Name: "lookup", Arguments: json.RawMessage(`{"q":"x"}`)},
			}),
			antTestMsg(core.RoleTool, core.ContentPart{
				Type:       core.PartToolResult,
				ToolResult: &core.ToolResult{CallID: "call_1", Content: "result"},
			}),
			antTestMsg(core.RoleTool, core.ContentPart{
				Type:       core.PartToolResult,
				ToolResult: &core.ToolResult{CallID: "call_1", Content: "result-v2", IsError: true},
			}),
		},
	}
	rendered := antMustRender(t, req)

	msgs := rendered["messages"].([]any)
	if len(msgs) != 3 {
		t.Fatalf("got %d messages, want 3 (user, assistant, merged tool)", len(msgs))
	}
	if antMessageRole(t, rendered, 2) != "user" {
		t.Errorf("tool results must render as a user message, got %s", antMessageRole(t, rendered, 2))
	}
	blocks := antMessageBlocks(t, rendered, 2)
	if len(blocks) != 1 {
		t.Fatalf("duplicate tool_result for one id must be deduped, got %+v", blocks)
	}
	if blocks[0]["type"] != "tool_result" || blocks[0]["tool_use_id"] != "call_1" {
		t.Errorf("tool_result block = %+v", blocks[0])
	}
	if blocks[0]["content"] != "result-v2" || blocks[0]["is_error"] != true {
		t.Errorf("last result must win: %+v", blocks[0])
	}
}

// TestAnthropicRender_ToolInputAndSchemaNormalization covers: non-object
// tool_use arguments become {}, missing schema `type` is filled, an absent
// schema becomes {"type":"object"}, and a nameless tool call is dropped.
func TestAnthropicRender_ToolInputAndSchemaNormalization(t *testing.T) {
	req := &core.ChatRequest{
		Model: "claude-sonnet-4",
		Tools: []core.Tool{
			{Name: "no_schema"},
			{Name: "typeless", Parameters: json.RawMessage(`{"properties":{"a":{"enum":["x"]}}}`)},
		},
		Messages: []core.Message{
			antTestMsg(core.RoleUser, antText("hi")),
			antTestMsg(core.RoleAssistant,
				core.ContentPart{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "c1", Name: "broken", Arguments: json.RawMessage(`"not-an-object"`)}},
				core.ContentPart{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "c2", Arguments: json.RawMessage(`{"a":1}`)}},
			),
		},
	}
	rendered := antMustRender(t, req)

	tools := rendered["tools"].([]any)
	if len(tools) != 2 {
		t.Fatalf("tools = %+v", tools)
	}
	if schema := tools[0].(map[string]any)["input_schema"].(map[string]any); schema["type"] != "object" {
		t.Errorf("absent schema must become {\"type\":\"object\"}: %+v", schema)
	}
	inner := tools[1].(map[string]any)["input_schema"].(map[string]any)
	if inner["type"] != "object" {
		t.Errorf("properties node must gain type:object: %+v", inner)
	}
	prop := inner["properties"].(map[string]any)["a"].(map[string]any)
	if prop["type"] != "string" {
		t.Errorf("enum node must gain type:string: %+v", prop)
	}

	blocks := antMessageBlocks(t, rendered, 1)
	if len(blocks) != 1 {
		t.Fatalf("nameless tool_use must be dropped, got %+v", blocks)
	}
	if blocks[0]["type"] != "tool_use" || blocks[0]["name"] != "broken" {
		t.Errorf("tool_use block = %+v", blocks[0])
	}
	input, ok := blocks[0]["input"].(map[string]any)
	if !ok || len(input) != 0 {
		t.Errorf("non-object input must normalize to {}, got %+v", blocks[0]["input"])
	}
}

// TestAnthropicRender_Thinking covers the thinking block: budget from the
// canonical config, max_tokens pushed above the budget, temperature/top_p
// dropped, and unsigned thinking parts omitted from the history.
func TestAnthropicRender_Thinking(t *testing.T) {
	temp := 0.7
	topP := 0.5
	req := &core.ChatRequest{
		Model:       "claude-sonnet-4",
		MaxTokens:   new(2000),
		Temperature: &temp,
		TopP:        &topP,
		Reasoning:   &core.ReasoningConfig{Effort: "medium"},
		Messages: []core.Message{
			antTestMsg(core.RoleUser, antText("hi")),
			antTestMsg(core.RoleAssistant,
				core.ContentPart{Type: core.PartThinking, Text: "unsigned"},
				core.ContentPart{Type: core.PartThinking, Text: "signed", Signature: "sig"},
			),
		},
	}
	rendered := antMustRender(t, req)

	thinking := rendered["thinking"].(map[string]any)
	if thinking["type"] != "enabled" || int(thinking["budget_tokens"].(float64)) != 4096 {
		t.Errorf("thinking = %+v, want enabled/4096 for medium effort", thinking)
	}
	if _, ok := rendered["temperature"]; ok {
		t.Error("temperature must be dropped when thinking is enabled")
	}
	if _, ok := rendered["top_p"]; ok {
		t.Error("top_p must be dropped when thinking is enabled")
	}
	if mt := int(rendered["max_tokens"].(float64)); mt <= 4096 {
		t.Errorf("max_tokens = %d, must exceed the thinking budget", mt)
	}
	blocks := antMessageBlocks(t, rendered, 1)
	if len(blocks) != 1 {
		t.Fatalf("only signed thinking may be replayed, got %+v", blocks)
	}
	if blocks[0]["type"] != "thinking" || blocks[0]["signature"] != "sig" {
		t.Errorf("thinking block = %+v", blocks[0])
	}

	// Effort mapping table.
	for effort, want := range map[string]int{"low": 1024, "medium": 4096, "high": 16384, "xhigh": 32768} {
		req := &core.ChatRequest{
			Model:     "claude-sonnet-4",
			Reasoning: &core.ReasoningConfig{Effort: effort},
			Messages:  []core.Message{antTestMsg(core.RoleUser, antText("hi"))},
		}
		got := int(antMustRender(t, req)["thinking"].(map[string]any)["budget_tokens"].(float64))
		if got != want {
			t.Errorf("effort %s => budget %d, want %d", effort, got, want)
		}
	}

	// No reasoning -> no thinking block.
	req = &core.ChatRequest{Model: "claude-sonnet-4", Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))}}
	if _, ok := antMustRender(t, req)["thinking"]; ok {
		t.Error("thinking must be absent when no reasoning was requested")
	}
}

// TestAnthropicRender_ToolChoiceAndPassthrough covers the tool_choice inverse
// mapping, system string rendering, and the safe Extra passthrough keys.
func TestAnthropicRender_ToolChoiceAndPassthrough(t *testing.T) {
	cases := []struct {
		mode string
		name string
		want string
	}{
		{"auto", "", "auto"},
		{"none", "", "none"},
		{"required", "", "any"},
		{"function", "f", "tool"},
	}
	for _, tc := range cases {
		req := &core.ChatRequest{
			Model:      "claude-sonnet-4",
			System:     "be terse",
			ToolChoice: &core.ToolChoice{Mode: tc.mode, Name: tc.name},
			Extra: map[string]json.RawMessage{
				"metadata": json.RawMessage(`{"user_id":"u"}`),
				"top_k":    json.RawMessage(`40`),
			},
			Messages: []core.Message{antTestMsg(core.RoleUser, antText("hi"))},
		}
		rendered := antMustRender(t, req)
		if rendered["system"] != "be terse" {
			t.Errorf("system = %v", rendered["system"])
		}
		tcOut := rendered["tool_choice"].(map[string]any)
		if tcOut["type"] != tc.want {
			t.Errorf("mode %s => tool_choice.type %v, want %s", tc.mode, tcOut["type"], tc.want)
		}
		if tc.name != "" && tcOut["name"] != tc.name {
			t.Errorf("mode %s => name %v, want %s", tc.mode, tcOut["name"], tc.name)
		}
		if rendered["metadata"].(map[string]any)["user_id"] != "u" {
			t.Errorf("metadata not passed through: %v", rendered["metadata"])
		}
		if int(rendered["top_k"].(float64)) != 40 {
			t.Errorf("top_k not passed through: %v", rendered["top_k"])
		}
	}
}

// ---- ParseResponse / RenderResponse ----------------------------------------

func TestAnthropicParseResponse(t *testing.T) {
	body := []byte(`{
		"id": "msg_1",
		"model": "claude-sonnet-4",
		"stop_reason": "tool_use",
		"content": [
			{"type":"thinking","thinking":"why","signature":"s"},
			{"type":"text","text":"ok"},
			{"type":"tool_use","id":"toolu_9","name":"lookup","input":{"q":"x"}}
		],
		"usage": {"input_tokens": 10, "output_tokens": 5, "cache_read_input_tokens": 3, "cache_creation_input_tokens": 2}
	}`)
	resp, err := AnthropicCodec{}.ParseResponse(body, "fallback-model")
	if err != nil {
		t.Fatalf("ParseResponse: %v", err)
	}
	if resp.ID != "msg_1" || resp.Model != "claude-sonnet-4" {
		t.Errorf("id/model = %q/%q", resp.ID, resp.Model)
	}
	if resp.FinishReason != core.FinishToolCalls {
		t.Errorf("finish = %q, want tool_calls", resp.FinishReason)
	}
	if len(resp.Message.Content) != 3 {
		t.Fatalf("content = %+v", resp.Message.Content)
	}
	if resp.Message.Content[0].Signature != "s" {
		t.Errorf("thinking signature lost: %+v", resp.Message.Content[0])
	}
	if got := string(resp.Message.Content[2].ToolCall.Arguments); got != `{"q":"x"}` {
		t.Errorf("tool args = %s", got)
	}
	// Canonical prompt tokens include cache read + write.
	if resp.Usage.PromptTokens != 15 || resp.Usage.CachedTokens != 3 || resp.Usage.CacheWriteTokens != 2 {
		t.Errorf("usage = %+v", resp.Usage)
	}
	if resp.Usage.CompletionTokens != 5 || resp.Usage.TotalTokens != 20 {
		t.Errorf("usage totals = %+v", resp.Usage)
	}

	// Fallback model is used when the body omits one.
	resp, err = AnthropicCodec{}.ParseResponse([]byte(`{"id":"m","content":[]}`), "fallback")
	if err != nil {
		t.Fatalf("ParseResponse: %v", err)
	}
	if resp.Model != "fallback" || resp.FinishReason != core.FinishStop {
		t.Errorf("fallback response = %+v", resp)
	}
}

// TestAnthropicRenderResponse covers the client-facing message envelope,
// including stop_reason mapping and the input_tokens back-conversion.
func TestAnthropicRenderResponse(t *testing.T) {
	for _, tc := range []struct {
		finish core.FinishReason
		want   string
	}{
		{core.FinishStop, "end_turn"},
		{core.FinishLength, "max_tokens"},
		{core.FinishToolCalls, "tool_use"},
		{core.FinishFilter, "refusal"},
	} {
		resp := &core.ChatResponse{
			ID:           "chatcmpl-1",
			Model:        "claude-sonnet-4",
			FinishReason: tc.finish,
			Usage:        core.Usage{PromptTokens: 20, CompletionTokens: 7, TotalTokens: 27, CachedTokens: 6, CacheWriteTokens: 4},
			Message: core.Message{Role: core.RoleAssistant, Content: []core.ContentPart{
				{Type: core.PartText, Text: "hi"},
				{Type: core.PartThinking, Text: "t", Signature: "sig"},
				{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "call_1", Name: "f", Arguments: json.RawMessage(``)}},
			}},
		}
		body, err := AnthropicCodec{}.RenderResponse(resp)
		if err != nil {
			t.Fatalf("RenderResponse: %v", err)
		}
		var out map[string]any
		if err := json.Unmarshal(body, &out); err != nil {
			t.Fatalf("bad JSON: %v", err)
		}
		if out["type"] != "message" || out["role"] != "assistant" || out["model"] != "claude-sonnet-4" {
			t.Errorf("envelope = %+v", out)
		}
		if out["stop_reason"] != tc.want {
			t.Errorf("finish %s => stop_reason %v, want %s", tc.finish, out["stop_reason"], tc.want)
		}
		if v, ok := out["stop_sequence"]; !ok || v != nil {
			t.Errorf("stop_sequence must be present and null, got %v (present=%v)", v, ok)
		}
		usage := out["usage"].(map[string]any)
		if int(usage["input_tokens"].(float64)) != 10 {
			t.Errorf("input_tokens = %v, want prompt-cached-cache_write = 10", usage["input_tokens"])
		}
		if int(usage["output_tokens"].(float64)) != 7 {
			t.Errorf("output_tokens = %v", usage["output_tokens"])
		}
		if int(usage["cache_read_input_tokens"].(float64)) != 6 ||
			int(usage["cache_creation_input_tokens"].(float64)) != 4 {
			t.Errorf("cache usage = %+v", usage)
		}

		blocks := out["content"].([]any)
		if len(blocks) != 3 {
			t.Fatalf("content = %+v", blocks)
		}
		if blocks[0].(map[string]any)["text"] != "hi" {
			t.Errorf("text block = %+v", blocks[0])
		}
		if blocks[1].(map[string]any)["signature"] != "sig" {
			t.Errorf("thinking block = %+v", blocks[1])
		}
		input, ok := blocks[2].(map[string]any)["input"].(map[string]any)
		if !ok || len(input) != 0 {
			t.Errorf("tool_use input must be an object, got %+v", blocks[2].(map[string]any)["input"])
		}
	}

	// Negative usage must never produce a negative input_tokens.
	body, err := AnthropicCodec{}.RenderResponse(&core.ChatResponse{
		ID: "m", Usage: core.Usage{PromptTokens: 1, CachedTokens: 5},
	})
	if err != nil {
		t.Fatalf("RenderResponse: %v", err)
	}
	var out map[string]any
	_ = json.Unmarshal(body, &out)
	if got := int(out["usage"].(map[string]any)["input_tokens"].(float64)); got != 0 {
		t.Errorf("input_tokens = %d, want 0 floor", got)
	}
}

// ---- ParseStreamEvent -------------------------------------------------------

// TestAnthropicParseStream covers the upstream event sequence, including the
// wire-block-index → tool-call-index mapping and cumulative usage merging.
func TestAnthropicParseStream(t *testing.T) {
	codec := AnthropicCodec{}
	state := &StreamState{Model: "echo"}

	chunks, err := codec.ParseStreamEvent("message_start", []byte(`{"type":"message_start","message":{"id":"msg_9","model":"claude-sonnet-4","usage":{"input_tokens":10,"cache_read_input_tokens":2}}}`), state)
	if err != nil {
		t.Fatalf("message_start: %v", err)
	}
	if len(chunks) != 1 || chunks[0].Type != core.ChunkUsage {
		t.Fatalf("message_start chunks = %+v", chunks)
	}
	if chunks[0].Usage.PromptTokens != 12 || chunks[0].Usage.CachedTokens != 2 {
		t.Errorf("message_start usage = %+v", chunks[0].Usage)
	}
	if state.MessageID != "msg_9" {
		t.Errorf("state id = %q, want msg_9", state.MessageID)
	}
	// The caller-preset model is preserved (it is the name to echo to the client).
	if state.Model != "echo" {
		t.Errorf("state model = %q, want the caller-preset echo", state.Model)
	}

	// A text block start and ping emit nothing.
	for _, ev := range []struct{ name, data string }{
		{"content_block_start", `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`},
		{"ping", `{"type":"ping"}`},
		{"content_block_stop", `{"type":"content_block_stop","index":0}`},
	} {
		got, err := codec.ParseStreamEvent(ev.name, []byte(ev.data), state)
		if err != nil {
			t.Fatalf("%s: %v", ev.name, err)
		}
		if len(got) != 0 {
			t.Errorf("%s emitted %+v, want nothing", ev.name, got)
		}
	}

	chunks, _ = codec.ParseStreamEvent("content_block_delta", []byte(`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}`), state)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkText || chunks[0].Delta != "hi" {
		t.Errorf("text_delta chunks = %+v", chunks)
	}

	chunks, _ = codec.ParseStreamEvent("content_block_delta", []byte(`{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hm"}}`), state)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkThinking || chunks[0].Delta != "hm" {
		t.Errorf("thinking_delta chunks = %+v", chunks)
	}

	chunks, _ = codec.ParseStreamEvent("content_block_delta", []byte(`{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig"}}`), state)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkThinking || chunks[0].Signature != "sig" {
		t.Errorf("signature_delta chunks = %+v", chunks)
	}

	// Tool call: block index 1 and 3 map to tool indices 0 and 1.
	chunks, _ = codec.ParseStreamEvent("content_block_start", []byte(`{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"a"}}`), state)
	if len(chunks) != 1 || chunks[0].Type != core.ChunkToolCall || chunks[0].Index != 0 {
		t.Fatalf("tool_use start chunks = %+v", chunks)
	}
	if chunks[0].ToolCall.Name != "a" || chunks[0].ToolCall.ID != "toolu_1" {
		t.Errorf("tool_use start call = %+v, want name a id toolu_1", chunks[0].ToolCall)
	}
	chunks, _ = codec.ParseStreamEvent("content_block_start", []byte(`{"type":"content_block_start","index":3,"content_block":{"type":"tool_use","id":"toolu_2","name":"b"}}`), state)
	if len(chunks) != 1 || chunks[0].Index != 1 {
		t.Fatalf("second tool_use start chunks = %+v", chunks)
	}
	chunks, _ = codec.ParseStreamEvent("content_block_delta", []byte(`{"type":"content_block_delta","index":3,"delta":{"type":"input_json_delta","partial_json":"{\"a\":"}}`), state)
	if len(chunks) != 1 || chunks[0].Index != 1 || string(chunks[0].ToolCall.Arguments) != `{"a":` {
		t.Errorf("input_json_delta chunks = %+v", chunks)
	}

	// message_delta: finish + merged cumulative usage.
	chunks, _ = codec.ParseStreamEvent("message_delta", []byte(`{"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":42}}`), state)
	if len(chunks) != 2 {
		t.Fatalf("message_delta chunks = %+v", chunks)
	}
	if chunks[0].Type != core.ChunkFinish || chunks[0].FinishReason != core.FinishLength {
		t.Errorf("finish chunk = %+v", chunks[0])
	}
	if chunks[1].Type != core.ChunkUsage || chunks[1].Usage.PromptTokens != 12 || chunks[1].Usage.CompletionTokens != 42 {
		t.Errorf("merged usage = %+v", chunks[1].Usage)
	}
	if chunks[1].Usage.TotalTokens != 54 {
		t.Errorf("total tokens = %d, want 54", chunks[1].Usage.TotalTokens)
	}

	// message_stop emits nothing.
	if got, _ := codec.ParseStreamEvent("message_stop", []byte(`{"type":"message_stop"}`), state); len(got) != 0 {
		t.Errorf("message_stop emitted %+v", got)
	}
}

func TestAnthropicParseStreamError(t *testing.T) {
	chunks, err := AnthropicCodec{}.ParseStreamEvent("error", []byte(`{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`), &StreamState{})
	if err != nil {
		t.Fatalf("error event: %v", err)
	}
	if len(chunks) != 1 || chunks[0].Type != core.ChunkError {
		t.Fatalf("chunks = %+v", chunks)
	}
	pe, ok := chunks[0].Err.(*core.ProviderError)
	if !ok {
		t.Fatalf("Err = %T, want *core.ProviderError", chunks[0].Err)
	}
	if pe.Kind != core.ErrRateLimit || pe.Message != "Overloaded" {
		t.Errorf("provider error = %+v", pe)
	}
}

// ---- RenderStreamChunk / RenderStreamDone -----------------------------------

// TestAnthropicRenderStream_EventOrder walks a realistic canonical chunk
// sequence and asserts the exact Anthropic event ordering, block index
// management, and that Done terminates with message_stop.
func TestAnthropicRenderStream_EventOrder(t *testing.T) {
	codec := AnthropicCodec{}
	state := &StreamState{Model: "claude-sonnet-4", MessageID: "msg_42"}

	chunks := []core.StreamChunk{
		{Type: core.ChunkText, Delta: "Hel"},
		{Type: core.ChunkText, Delta: "lo"},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "toolu_1", Name: "lookup"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"q":`)}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`"x"}`)}},
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 11, CompletionTokens: 3, TotalTokens: 14}},
		{Type: core.ChunkFinish, FinishReason: core.FinishToolCalls},
	}

	var raw []byte
	for _, c := range chunks {
		events, err := codec.RenderStreamChunk(c, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%s): %v", c.Type, err)
		}
		for _, e := range events {
			raw = append(raw, e...)
		}
	}
	events := antParseEvents(t, raw)
	got := antEventNames(events)
	want := []string{
		"message_start",
		"content_block_start", // text index 0
		"content_block_delta",
		"content_block_delta",
		"content_block_stop",  // close text
		"content_block_start", // tool_use index 1
		"content_block_delta",
		"content_block_delta",
		"content_block_stop", // close tool
		"message_delta",
	}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("event order:\n got %v\nwant %v", got, want)
	}

	// message_start echoes the caller-supplied id and model.
	start := events[0].Data["message"].(map[string]any)
	if start["id"] != "msg_42" || start["model"] != "claude-sonnet-4" || start["role"] != "assistant" {
		t.Errorf("message_start message = %+v", start)
	}
	if int(start["usage"].(map[string]any)["input_tokens"].(float64)) != 0 {
		t.Errorf("message_start usage = %+v, want zeros (usage chunk came later)", start["usage"])
	}

	// Text block opens at index 0, tool block at index 1.
	if idx := int(events[1].Data["index"].(float64)); idx != 0 {
		t.Errorf("text block index = %d, want 0", idx)
	}
	block := events[1].Data["content_block"].(map[string]any)
	if block["type"] != "text" {
		t.Errorf("first block = %+v", block)
	}
	if idx := int(events[5].Data["index"].(float64)); idx != 1 {
		t.Errorf("tool block index = %d, want 1", idx)
	}
	block = events[5].Data["content_block"].(map[string]any)
	if block["type"] != "tool_use" || block["name"] != "lookup" {
		t.Errorf("tool block = %+v", block)
	}
	// The canonical id is echoed verbatim so the client's tool_result can be
	// matched back to it.
	if id, _ := block["id"].(string); id != "toolu_1" {
		t.Errorf("tool id = %q, want toolu_1", id)
	}

	// Argument fragments must be forwarded verbatim.
	if d := events[6].Data["delta"].(map[string]any); d["partial_json"] != `{"q":` {
		t.Errorf("first arg delta = %+v", d)
	}
	if d := events[7].Data["delta"].(map[string]any); d["partial_json"] != `"x"}` {
		t.Errorf("second arg delta = %+v", d)
	}

	// message_delta carries the stop reason and accumulated output tokens.
	md := events[9].Data
	if md["delta"].(map[string]any)["stop_reason"] != "tool_use" {
		t.Errorf("message_delta = %+v", md)
	}
	if int(md["usage"].(map[string]any)["output_tokens"].(float64)) != 3 {
		t.Errorf("message_delta usage = %+v", md["usage"])
	}

	// Done terminates the stream exactly once.
	done := codec.RenderStreamDone(state)
	doneEvents := antParseEvents(t, append(raw, concat(done)...))
	if last := antEventNames(doneEvents)[len(doneEvents)-1]; last != "message_stop" {
		t.Errorf("last event = %q, want message_stop", last)
	}
	// message_delta must not be repeated by Done once the finish chunk ran.
	count := 0
	for _, n := range antEventNames(doneEvents) {
		if n == "message_delta" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("message_delta emitted %d times, want 1", count)
	}
}

func concat(bs [][]byte) []byte {
	var out []byte
	for _, b := range bs {
		out = append(out, b...)
	}
	return out
}

// TestAnthropicRenderStream_DoneWithoutChunks covers the contract requirement
// that RenderStreamDone always produces a well-formed terminal sequence, even
// when no canonical chunk was ever seen.
func TestAnthropicRenderStream_DoneWithoutChunks(t *testing.T) {
	state := &StreamState{Model: "claude-sonnet-4"}
	done := AnthropicCodec{}.RenderStreamDone(state)
	got := antEventNames(antParseEvents(t, concat(done)))
	want := []string{"message_start", "message_delta", "message_stop"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("done sequence = %v, want %v", got, want)
	}
}

// TestAnthropicRenderStream_BlockSwitching covers the rule that switching chunk
// kind closes the previous content block and opens a new one at the next index,
// and that a thinking block carries thinking_delta / signature_delta.
func TestAnthropicRenderStream_BlockSwitching(t *testing.T) {
	codec := AnthropicCodec{}
	state := &StreamState{Model: "m"}

	chunks := []core.StreamChunk{
		{Type: core.ChunkThinking, Delta: "why"},
		{Type: core.ChunkThinking, Signature: "sig"},
		{Type: core.ChunkText, Delta: "answer"},
	}
	var raw []byte
	for _, c := range chunks {
		events, err := codec.RenderStreamChunk(c, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk: %v", err)
		}
		raw = append(raw, concat(events)...)
	}
	events := antParseEvents(t, raw)
	got := antEventNames(events)
	want := []string{
		"message_start",
		"content_block_start", // thinking index 0
		"content_block_delta", // thinking_delta
		"content_block_delta", // signature_delta
		"content_block_stop",
		"content_block_start", // text index 1
		"content_block_delta", // text_delta
	}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("event order:\n got %v\nwant %v", got, want)
	}
	if events[1].Data["content_block"].(map[string]any)["type"] != "thinking" {
		t.Errorf("block = %+v", events[1].Data)
	}
	if d := events[2].Data["delta"].(map[string]any); d["type"] != "thinking_delta" || d["thinking"] != "why" {
		t.Errorf("thinking delta = %+v", d)
	}
	if d := events[3].Data["delta"].(map[string]any); d["type"] != "signature_delta" || d["signature"] != "sig" {
		t.Errorf("signature delta = %+v", d)
	}
	if idx := int(events[4].Data["index"].(float64)); idx != 0 {
		t.Errorf("stop index = %d, want 0", idx)
	}
	if idx := int(events[5].Data["index"].(float64)); idx != 1 {
		t.Errorf("new text block index = %d, want 1", idx)
	}
}

// TestAnthropicRenderStream_TwoToolCalls covers two interleaved tool calls
// getting distinct blocks, and a second header for the same index not
// reopening a block.
func TestAnthropicRenderStream_TwoToolCalls(t *testing.T) {
	codec := AnthropicCodec{}
	state := &StreamState{Model: "m"}

	chunks := []core.StreamChunk{
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_a", Name: "a"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{}`)}},
		{Type: core.ChunkToolCall, Index: 1, ToolCall: &core.ToolCall{ID: "call_b", Name: "b"}},
		{Type: core.ChunkToolCall, Index: 1, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"z":1}`)}},
	}
	var raw []byte
	for _, c := range chunks {
		events, err := codec.RenderStreamChunk(c, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk: %v", err)
		}
		raw = append(raw, concat(events)...)
	}
	events := antParseEvents(t, raw)
	got := antEventNames(events)
	want := []string{
		"message_start",
		"content_block_start", // tool 0
		"content_block_stop",  // closed when tool 1 opens
		"content_block_start", // tool 1
		"content_block_delta", // only the non-empty fragment
	}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("event order:\n got %v\nwant %v", got, want)
	}
	if events[1].Data["content_block"].(map[string]any)["name"] != "a" {
		t.Errorf("first tool block = %+v", events[1].Data)
	}
	if events[3].Data["content_block"].(map[string]any)["name"] != "b" {
		t.Errorf("second tool block = %+v", events[3].Data)
	}
	if idx := int(events[3].Data["index"].(float64)); idx != 1 {
		t.Errorf("second tool index = %d, want 1", idx)
	}
}

// TestAnthropicRenderStream_ErrorEvent covers mid-stream error rendering.
func TestAnthropicRenderStream_ErrorEvent(t *testing.T) {
	state := &StreamState{Model: "m"}
	events, err := AnthropicCodec{}.RenderStreamChunk(core.StreamChunk{
		Type: core.ChunkError,
		Err:  &core.ProviderError{Kind: core.ErrUpstream, Message: "boom"},
	}, state)
	if err != nil {
		t.Fatalf("RenderStreamChunk: %v", err)
	}
	parsed := antParseEvents(t, concat(events))
	if len(parsed) != 1 || parsed[0].Name != "error" {
		t.Fatalf("events = %v", antEventNames(parsed))
	}
	if parsed[0].Data["type"] != "error" {
		t.Errorf("payload = %+v", parsed[0].Data)
	}
	inner := parsed[0].Data["error"].(map[string]any)
	if inner["type"] != "api_error" || !strings.Contains(inner["message"].(string), "boom") {
		t.Errorf("error payload = %+v", inner)
	}
}

// TestAnthropicStreamRoundTrip feeds rendered events back through the parser to
// prove the renderer and parser agree on the wire shape.
func TestAnthropicStreamRoundTrip(t *testing.T) {
	codec := AnthropicCodec{}
	renderState := &StreamState{Model: "claude-sonnet-4", MessageID: "msg_1"}
	var raw []byte
	for _, c := range []core.StreamChunk{
		{Type: core.ChunkText, Delta: "hi "},
		{Type: core.ChunkText, Delta: "there"},
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 7, CompletionTokens: 2, TotalTokens: 9}},
		{Type: core.ChunkFinish, FinishReason: core.FinishStop},
	} {
		events, err := codec.RenderStreamChunk(c, renderState)
		if err != nil {
			t.Fatalf("RenderStreamChunk: %v", err)
		}
		raw = append(raw, concat(events)...)
	}
	raw = append(raw, concat(mustDone(t, codec.RenderStreamDone(renderState)))...)

	parseState := &StreamState{}
	var text strings.Builder
	var finish core.FinishReason
	var usage core.Usage
	for _, ev := range antParseEvents(t, raw) {
		data, _ := json.Marshal(ev.Data)
		chunks, err := codec.ParseStreamEvent(ev.Name, data, parseState)
		if err != nil {
			t.Fatalf("ParseStreamEvent(%s): %v", ev.Name, err)
		}
		for _, c := range chunks {
			switch c.Type {
			case core.ChunkText:
				text.WriteString(c.Delta)
			case core.ChunkFinish:
				finish = c.FinishReason
			case core.ChunkUsage:
				if c.Usage.CompletionTokens > 0 {
					usage = *c.Usage
				}
			}
		}
	}
	if text.String() != "hi there" {
		t.Errorf("round-tripped text = %q", text.String())
	}
	if finish != core.FinishStop {
		t.Errorf("round-tripped finish = %q", finish)
	}
	if usage.PromptTokens != 7 || usage.CompletionTokens != 2 {
		t.Errorf("round-tripped usage = %+v", usage)
	}
	if parseState.MessageID != "msg_1" {
		t.Errorf("round-tripped message id = %q", parseState.MessageID)
	}
}

func mustDone(t *testing.T, events [][]byte) [][]byte {
	t.Helper()
	return events
}

// TestAnthropicStreamInterface asserts the codec satisfies the interface the
// registry expects.
func TestAnthropicStreamInterface(t *testing.T) {
	var c Codec = AnthropicCodec{}
	if c.Dialect() != core.DialectAnthropic {
		t.Errorf("dialect = %q", c.Dialect())
	}
}
