package transform

import (
	"encoding/json"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

func mustParseRequest(t *testing.T, body string) *core.ChatRequest {
	t.Helper()
	req, err := OpenAICodec{}.ParseRequest([]byte(body))
	if err != nil {
		t.Fatalf("ParseRequest(%s) error: %v", body, err)
	}
	return req
}

func mustRenderRequest(t *testing.T, req *core.ChatRequest, providerID string) map[string]any {
	t.Helper()
	body, err := OpenAICodec{}.RenderRequest(req, providerID)
	if err != nil {
		t.Fatalf("RenderRequest error: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("RenderRequest produced invalid JSON (%s): %v", body, err)
	}
	return out
}

func float64Ptr(v float64) *float64 { return &v }
func intPtr(v int) *int             { return &v }

func TestParseRequestBasic(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "gpt-4o",
		"temperature": 0.5,
		"top_p": 0.9,
		"max_tokens": 128,
		"stream": true,
		"stop": "\n",
		"user": "u-1",
		"seed": 7,
		"messages": [
			{"role": "system", "content": "be brief"},
			{"role": "developer", "content": "be terse"},
			{"role": "user", "content": "hi"}
		]
	}`)

	if req.Model != "gpt-4o" {
		t.Errorf("Model = %q", req.Model)
	}
	if req.System != "be brief\n\nbe terse" {
		t.Errorf("System = %q", req.System)
	}
	if len(req.Messages) != 1 || req.Messages[0].Role != core.RoleUser {
		t.Fatalf("Messages = %+v", req.Messages)
	}
	if got := req.Messages[0].TextContent(); got != "hi" {
		t.Errorf("user text = %q", got)
	}
	if req.Temperature == nil || *req.Temperature != 0.5 {
		t.Errorf("Temperature = %v", req.Temperature)
	}
	if req.TopP == nil || *req.TopP != 0.9 {
		t.Errorf("TopP = %v", req.TopP)
	}
	if req.MaxTokens == nil || *req.MaxTokens != 128 {
		t.Errorf("MaxTokens = %v", req.MaxTokens)
	}
	if !req.Stream {
		t.Error("Stream = false")
	}
	if len(req.Stop) != 1 || req.Stop[0] != "\n" {
		t.Errorf("Stop = %v", req.Stop)
	}
	for _, key := range []string{"user", "seed"} {
		if _, ok := req.Extra[key]; !ok {
			t.Errorf("Extra missing %q: %v", key, req.Extra)
		}
	}
	if _, ok := req.Extra["model"]; ok {
		t.Error("Extra must not repeat modelled fields")
	}
	if _, ok := req.Extra["messages"]; ok {
		t.Error("Extra must not carry messages")
	}
}

func TestParseRequestStopArrayAndReasoning(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "o3",
		"stop": ["a", "b"],
		"reasoning_effort": "high",
		"reasoning": {"max_tokens": 4096},
		"messages": [{"role": "user", "content": "x"}]
	}`)
	if len(req.Stop) != 2 || req.Stop[0] != "a" || req.Stop[1] != "b" {
		t.Errorf("Stop = %v", req.Stop)
	}
	if req.Reasoning == nil {
		t.Fatal("Reasoning = nil")
	}
	if req.Reasoning.Effort != "high" {
		t.Errorf("Reasoning.Effort = %q", req.Reasoning.Effort)
	}
	if req.Reasoning.MaxTokens != 4096 {
		t.Errorf("Reasoning.MaxTokens = %d", req.Reasoning.MaxTokens)
	}
}

func TestParseRequestReasoningObjectEffortWins(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "o3",
		"reasoning_effort": "low",
		"reasoning": {"effort": "medium"},
		"messages": [{"role": "user", "content": "x"}]
	}`)
	if req.Reasoning == nil || req.Reasoning.Effort != "medium" {
		t.Errorf("Reasoning = %+v", req.Reasoning)
	}
}

func TestParseRequestReasoningAbsent(t *testing.T) {
	req := mustParseRequest(t, `{"model":"m","messages":[{"role":"user","content":"x"}]}`)
	if req.Reasoning != nil {
		t.Errorf("Reasoning = %+v, want nil", req.Reasoning)
	}
}

func TestParseRequestContentPartsAndImages(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "m",
		"messages": [{"role":"user","content":[
			{"type":"text","text":"what is this?"},
			{"type":"image_url","image_url":{"url":"data:image/png;base64,QUJD"}},
			{"type":"image_url","image_url":{"url":"https://example.com/a.png"}}
		]}]
	}`)
	if len(req.Messages) != 1 {
		t.Fatalf("Messages = %+v", req.Messages)
	}
	parts := req.Messages[0].Content
	if len(parts) != 3 {
		t.Fatalf("parts = %+v", parts)
	}
	if parts[0].Type != core.PartText || parts[0].Text != "what is this?" {
		t.Errorf("parts[0] = %+v", parts[0])
	}
	if parts[1].Type != core.PartImage || parts[1].Media == nil {
		t.Fatalf("parts[1] = %+v", parts[1])
	}
	if parts[1].Media.MIMEType != "image/png" || parts[1].Media.Data != "QUJD" || parts[1].Media.URL != "" {
		t.Errorf("data URL media = %+v", parts[1].Media)
	}
	if parts[2].Media == nil || parts[2].Media.URL != "https://example.com/a.png" || parts[2].Media.Data != "" {
		t.Errorf("remote URL media = %+v", parts[2].Media)
	}
}

func TestParseRequestToolCallsAndResults(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "m",
		"messages": [
			{"role":"assistant","content":null,"reasoning_content":"thinking hard","tool_calls":[
				{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"SF\"}"}}
			]},
			{"role":"tool","tool_call_id":"call_1","content":"sunny"}
		]
	}`)
	if len(req.Messages) != 2 {
		t.Fatalf("Messages = %+v", req.Messages)
	}
	assistant := req.Messages[0]
	if assistant.Role != core.RoleAssistant {
		t.Fatalf("role = %q", assistant.Role)
	}
	if len(assistant.Content) != 2 {
		t.Fatalf("assistant content = %+v", assistant.Content)
	}
	if assistant.Content[0].Type != core.PartThinking || assistant.Content[0].Text != "thinking hard" {
		t.Errorf("thinking part = %+v", assistant.Content[0])
	}
	tc := assistant.Content[1]
	if tc.Type != core.PartToolCall || tc.ToolCall == nil {
		t.Fatalf("tool call part = %+v", tc)
	}
	if tc.ToolCall.ID != "call_1" || tc.ToolCall.Name != "get_weather" {
		t.Errorf("tool call = %+v", tc.ToolCall)
	}
	if string(tc.ToolCall.Arguments) != `{"city":"SF"}` {
		t.Errorf("arguments = %s", tc.ToolCall.Arguments)
	}

	toolMsg := req.Messages[1]
	if toolMsg.Role != core.RoleTool {
		t.Fatalf("tool role = %q", toolMsg.Role)
	}
	if len(toolMsg.Content) != 1 || toolMsg.Content[0].Type != core.PartToolResult {
		t.Fatalf("tool content = %+v", toolMsg.Content)
	}
	res := toolMsg.Content[0].ToolResult
	if res == nil || res.CallID != "call_1" || res.Content != "sunny" {
		t.Errorf("tool result = %+v", res)
	}
}

func TestParseRequestToolsAndToolChoice(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "m",
		"tools": [
			{"type":"function","function":{"name":"a","description":"da","parameters":{"type":"object"}}},
			{"type":"retrieval"}
		],
		"tool_choice": {"type":"function","function":{"name":"a"}},
		"messages": [{"role":"user","content":"x"}]
	}`)
	if len(req.Tools) != 1 {
		t.Fatalf("Tools = %+v", req.Tools)
	}
	if req.Tools[0].Name != "a" || req.Tools[0].Description != "da" {
		t.Errorf("tool = %+v", req.Tools[0])
	}
	if string(req.Tools[0].Parameters) != `{"type":"object"}` {
		t.Errorf("parameters = %s", req.Tools[0].Parameters)
	}
	if req.ToolChoice == nil || req.ToolChoice.Mode != "function" || req.ToolChoice.Name != "a" {
		t.Errorf("ToolChoice = %+v", req.ToolChoice)
	}
}

func TestParseRequestToolChoiceString(t *testing.T) {
	for _, mode := range []string{"auto", "none", "required"} {
		req := mustParseRequest(t, `{"model":"m","tool_choice":"`+mode+`","messages":[{"role":"user","content":"x"}]}`)
		if req.ToolChoice == nil || req.ToolChoice.Mode != mode {
			t.Errorf("mode %q -> %+v", mode, req.ToolChoice)
		}
	}
}

func TestParseRequestResponseFormatAndMaxCompletionTokens(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "gpt-5",
		"max_completion_tokens": 512,
		"response_format": {"type":"json_schema","json_schema":{"name":"r"}},
		"messages": [{"role":"user","content":"x"}]
	}`)
	if req.MaxCompletionTokens == nil || *req.MaxCompletionTokens != 512 {
		t.Errorf("MaxCompletionTokens = %v", req.MaxCompletionTokens)
	}
	if req.MaxTokens != nil {
		t.Errorf("MaxTokens = %v, want nil", req.MaxTokens)
	}
	if !strings.Contains(string(req.ResponseFormat), `"json_schema"`) {
		t.Errorf("ResponseFormat = %s", req.ResponseFormat)
	}
}

func TestParseRequestErrors(t *testing.T) {
	cases := map[string]string{
		"invalid json":   `{"model":`,
		"missing model":  `{"messages":[{"role":"user","content":"x"}]}`,
		"no messages":    `{"model":"m"}`,
		"empty messages": `{"model":"m","messages":[]}`,
	}
	for name, body := range cases {
		if _, err := (OpenAICodec{}).ParseRequest([]byte(body)); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}

func TestRenderRequestRoundTrip(t *testing.T) {
	req := mustParseRequest(t, `{
		"model": "gpt-4o",
		"temperature": 0.2,
		"top_p": 0.8,
		"max_tokens": 64,
		"stop": ["END"],
		"stream": true,
		"seed": 11,
		"stream_options": {"include_usage": false},
		"response_format": {"type":"json_object"},
		"tools": [{"type":"function","function":{"name":"a","description":"da","parameters":{"type":"object"}}}],
		"tool_choice": "auto",
		"messages": [
			{"role":"system","content":"sys"},
			{"role":"user","content":"hello"},
			{"role":"assistant","content":"working","reasoning_content":"thinking","tool_calls":[
				{"id":"call_9","type":"function","function":{"name":"a","arguments":"{}"}}]},
			{"role":"tool","tool_call_id":"call_9","content":"done"}
		]
	}`)
	out := mustRenderRequest(t, req, "openai")

	if out["model"] != "gpt-4o" {
		t.Errorf("model = %v", out["model"])
	}
	msgs, _ := out["messages"].([]any)
	if len(msgs) != 4 {
		t.Fatalf("messages = %#v", out["messages"])
	}
	first, _ := msgs[0].(map[string]any)
	if first["role"] != "system" || first["content"] != "sys" {
		t.Errorf("first message = %#v", first)
	}
	assistant, _ := msgs[2].(map[string]any)
	if _, ok := assistant["reasoning_content"]; ok {
		t.Error("thinking parts must be dropped when rendering OpenAI")
	}
	if _, ok := assistant["tool_calls"]; !ok {
		t.Errorf("assistant tool_calls missing: %#v", assistant)
	}
	toolMsg, _ := msgs[3].(map[string]any)
	if toolMsg["role"] != "tool" || toolMsg["tool_call_id"] != "call_9" || toolMsg["content"] != "done" {
		t.Errorf("tool message = %#v", toolMsg)
	}
	if out["stop"] == nil || out["temperature"] != 0.2 || out["top_p"] != 0.8 {
		t.Errorf("sampling/stop = %#v", out)
	}
	if out["max_tokens"] != float64(64) {
		t.Errorf("max_tokens = %v", out["max_tokens"])
	}
	if out["stream"] != true {
		t.Errorf("stream = %v", out["stream"])
	}
	so, ok := out["stream_options"].(map[string]any)
	if !ok || so["include_usage"] != true {
		t.Errorf("stream_options = %#v", out["stream_options"])
	}
	if out["seed"] != float64(11) {
		t.Errorf("Extra passthrough seed = %v", out["seed"])
	}
	if out["tool_choice"] != "auto" {
		t.Errorf("tool_choice = %v", out["tool_choice"])
	}
	if out["response_format"] == nil {
		t.Error("response_format missing")
	}
	tools, _ := out["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("tools = %#v", out["tools"])
	}
}

func TestRenderRequestNoStreamOmitsStreamOptions(t *testing.T) {
	req := mustParseRequest(t, `{"model":"m","messages":[{"role":"user","content":"x"}]}`)
	out := mustRenderRequest(t, req, "openai")
	if _, ok := out["stream"]; ok {
		t.Error("stream must be omitted when false")
	}
	if _, ok := out["stream_options"]; ok {
		t.Error("stream_options must be omitted when not streaming")
	}
}

func TestRenderRequestMaxTokensSelection(t *testing.T) {
	cases := []struct {
		name       string
		req        *core.ChatRequest
		wantField  string
		wantValue  int
		wantAbsent string
	}{
		{
			name:      "legacy model uses max_tokens",
			req:       &core.ChatRequest{Model: "gpt-4o", MaxTokens: intPtr(100)},
			wantField: "max_tokens", wantValue: 100, wantAbsent: "max_completion_tokens",
		},
		{
			name:      "gpt-5 uses max_completion_tokens",
			req:       &core.ChatRequest{Model: "gpt-5-mini", MaxTokens: intPtr(100)},
			wantField: "max_completion_tokens", wantValue: 100, wantAbsent: "max_tokens",
		},
		{
			name:      "o-series uses max_completion_tokens",
			req:       &core.ChatRequest{Model: "o3-mini", MaxCompletionTokens: intPtr(200)},
			wantField: "max_completion_tokens", wantValue: 200, wantAbsent: "max_tokens",
		},
		{
			name:      "only MaxCompletionTokens on legacy model",
			req:       &core.ChatRequest{Model: "deepseek-chat", MaxCompletionTokens: intPtr(300)},
			wantField: "max_completion_tokens", wantValue: 300, wantAbsent: "max_tokens",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.req.Messages = []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "x"}}}}
			out := mustRenderRequest(t, tc.req, "openai")
			if out[tc.wantField] != float64(tc.wantValue) {
				t.Errorf("%s = %v, want %d", tc.wantField, out[tc.wantField], tc.wantValue)
			}
			if _, ok := out[tc.wantAbsent]; ok {
				t.Errorf("%s must be absent", tc.wantAbsent)
			}
		})
	}
}

func TestRenderRequestReasoningAndImages(t *testing.T) {
	req := &core.ChatRequest{
		Model:     "o3",
		Reasoning: &core.ReasoningConfig{Effort: "high", MaxTokens: 2048},
		Messages: []core.Message{{
			Role: core.RoleUser,
			Content: []core.ContentPart{
				{Type: core.PartText, Text: "look"},
				{Type: core.PartImage, Media: &core.MediaPayload{MIMEType: "image/jpeg", Data: "QUJD"}},
			},
		}},
	}
	out := mustRenderRequest(t, req, "openai")
	if out["reasoning_effort"] != "high" {
		t.Errorf("reasoning_effort = %v", out["reasoning_effort"])
	}
	reasoning, _ := out["reasoning"].(map[string]any)
	if reasoning["max_tokens"] != float64(2048) {
		t.Errorf("reasoning = %#v", out["reasoning"])
	}
	msgs, _ := out["messages"].([]any)
	content, _ := msgs[0].(map[string]any)["content"].([]any)
	if len(content) != 2 {
		t.Fatalf("content = %#v", content)
	}
	if content[0].(map[string]any)["type"] != "text" {
		t.Errorf("content[0] = %#v", content[0])
	}
	img := content[1].(map[string]any)
	if img["type"] != "image_url" {
		t.Fatalf("content[1] = %#v", img)
	}
	if got := img["image_url"].(map[string]any)["url"]; got != "data:image/jpeg;base64,QUJD" {
		t.Errorf("image url = %v", got)
	}
}

func TestRenderRequestMultipleToolResults(t *testing.T) {
	req := &core.ChatRequest{
		Model: "m",
		Messages: []core.Message{{
			Role: core.RoleTool,
			Content: []core.ContentPart{
				{Type: core.PartToolResult, ToolResult: &core.ToolResult{CallID: "call_a", Content: "one"}},
				{Type: core.PartToolResult, ToolResult: &core.ToolResult{CallID: "call_b", Content: "two"}},
			},
		}},
	}
	out := mustRenderRequest(t, req, "openai")
	msgs, _ := out["messages"].([]any)
	if len(msgs) != 2 {
		t.Fatalf("messages = %#v", out["messages"])
	}
	if msgs[0].(map[string]any)["tool_call_id"] != "call_a" || msgs[1].(map[string]any)["tool_call_id"] != "call_b" {
		t.Errorf("tool_call_ids = %#v", msgs)
	}
}

func TestRenderRequestEmptyContentNeverNull(t *testing.T) {
	req := &core.ChatRequest{
		Model:    "m",
		Messages: []core.Message{{Role: core.RoleAssistant}},
	}
	body, err := OpenAICodec{}.RenderRequest(req, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"content":""`) {
		t.Errorf("body = %s", body)
	}
}

func TestParseResponse(t *testing.T) {
	body := `{
		"id": "chatcmpl-1",
		"model": "gpt-4o",
		"choices": [{
			"index": 0,
			"message": {
				"role": "assistant",
				"content": "hello",
				"reasoning_content": "why",
				"tool_calls": [{"id":"call_1","type":"function","function":{"name":"f","arguments":"{\"a\":1}"}}]
			},
			"finish_reason": "tool_calls"
		}],
		"usage": {
			"prompt_tokens": 10,
			"completion_tokens": 5,
			"total_tokens": 15,
			"prompt_tokens_details": {"cached_tokens": 4},
			"completion_tokens_details": {"reasoning_tokens": 3}
		}
	}`
	resp, err := OpenAICodec{}.ParseResponse([]byte(body), "fallback")
	if err != nil {
		t.Fatal(err)
	}
	if resp.ID != "chatcmpl-1" || resp.Model != "gpt-4o" {
		t.Errorf("id/model = %q/%q", resp.ID, resp.Model)
	}
	if resp.FinishReason != core.FinishToolCalls {
		t.Errorf("finish = %q", resp.FinishReason)
	}
	if len(resp.Message.Content) != 3 {
		t.Fatalf("content = %+v", resp.Message.Content)
	}
	if resp.Message.Content[0].Type != core.PartThinking || resp.Message.Content[0].Text != "why" {
		t.Errorf("thinking = %+v", resp.Message.Content[0])
	}
	if resp.Message.Content[1].Type != core.PartText || resp.Message.Content[1].Text != "hello" {
		t.Errorf("text = %+v", resp.Message.Content[1])
	}
	tc := resp.Message.Content[2]
	if tc.Type != core.PartToolCall || tc.ToolCall.Name != "f" {
		t.Errorf("tool call = %+v", tc)
	}
	if resp.Usage.PromptTokens != 10 || resp.Usage.CompletionTokens != 5 || resp.Usage.TotalTokens != 15 {
		t.Errorf("usage = %+v", resp.Usage)
	}
	if resp.Usage.CachedTokens != 4 || resp.Usage.ReasoningTokens != 3 {
		t.Errorf("usage details = %+v", resp.Usage)
	}
}

func TestParseResponseEmptyChoicesAndModelFallback(t *testing.T) {
	resp, err := OpenAICodec{}.ParseResponse([]byte(`{"id":"x","choices":[]}`), "fallback")
	if err != nil {
		t.Fatal(err)
	}
	if resp.Model != "fallback" {
		t.Errorf("Model = %q", resp.Model)
	}
	if resp.FinishReason != core.FinishStop {
		t.Errorf("FinishReason = %q", resp.FinishReason)
	}
	if len(resp.Message.Content) != 0 {
		t.Errorf("content = %+v", resp.Message.Content)
	}
}

func TestRenderResponse(t *testing.T) {
	resp := &core.ChatResponse{
		Model: "gpt-4o",
		Message: core.Message{Role: core.RoleAssistant, Content: []core.ContentPart{
			{Type: core.PartThinking, Text: "why"},
			{Type: core.PartText, Text: "hello"},
			{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "call_1", Name: "f", Arguments: json.RawMessage(`{"a":1}`)}},
		}},
		FinishReason: core.FinishToolCalls,
		Usage:        core.Usage{PromptTokens: 1, CompletionTokens: 2, TotalTokens: 3, CachedTokens: 1},
	}
	body, err := OpenAICodec{}.RenderResponse(resp)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	if out["object"] != "chat.completion" {
		t.Errorf("object = %v", out["object"])
	}
	id, _ := out["id"].(string)
	if !strings.HasPrefix(id, "chatcmpl-") {
		t.Errorf("generated id = %q", id)
	}
	if _, ok := out["created"]; !ok {
		t.Error("created missing")
	}
	choices, _ := out["choices"].([]any)
	choice, _ := choices[0].(map[string]any)
	if choice["finish_reason"] != "tool_calls" {
		t.Errorf("finish_reason = %v", choice["finish_reason"])
	}
	msg, _ := choice["message"].(map[string]any)
	if msg["content"] != "hello" {
		t.Errorf("content = %v", msg["content"])
	}
	if msg["reasoning_content"] != "why" {
		t.Errorf("reasoning_content = %v", msg["reasoning_content"])
	}
	tcs, _ := msg["tool_calls"].([]any)
	if len(tcs) != 1 {
		t.Fatalf("tool_calls = %#v", msg["tool_calls"])
	}
	usage, _ := out["usage"].(map[string]any)
	if usage["prompt_tokens"] != float64(1) || usage["total_tokens"] != float64(3) {
		t.Errorf("usage = %#v", usage)
	}
}

func TestRenderResponseKeepsID(t *testing.T) {
	body, err := OpenAICodec{}.RenderResponse(&core.ChatResponse{ID: "chatcmpl-keep", Model: "m"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"id":"chatcmpl-keep"`) {
		t.Errorf("body = %s", body)
	}
}

func TestParseStreamEvent(t *testing.T) {
	codec := OpenAICodec{}
	state := &StreamState{Model: "gpt-4o"}

	if chunks, err := codec.ParseStreamEvent("", []byte("[DONE]"), state); err != nil || chunks != nil {
		t.Errorf("[DONE] -> %v, %v", chunks, err)
	}
	if chunks, err := codec.ParseStreamEvent("", []byte("  "), state); err != nil || chunks != nil {
		t.Errorf("blank -> %v, %v", chunks, err)
	}

	chunks, err := codec.ParseStreamEvent("", []byte(`{
		"id":"chatcmpl-s","model":"gpt-4o",
		"choices":[{"index":0,"delta":{"role":"assistant","content":"he","reasoning_content":"th","tool_calls":[
			{"index":0,"id":"call_1","function":{"name":"f","arguments":"{\"a\""}}]},"finish_reason":null}]
	}`), state)
	if err != nil {
		t.Fatal(err)
	}
	want := []core.ChunkType{core.ChunkThinking, core.ChunkText, core.ChunkToolCall}
	if len(chunks) != len(want) {
		t.Fatalf("chunks = %+v", chunks)
	}
	for i, typ := range want {
		if chunks[i].Type != typ {
			t.Errorf("chunks[%d].Type = %q, want %q", i, chunks[i].Type, typ)
		}
	}
	if chunks[0].Delta != "th" || chunks[1].Delta != "he" {
		t.Errorf("deltas = %q/%q", chunks[0].Delta, chunks[1].Delta)
	}
	tc := chunks[2]
	if tc.Index != 0 || tc.ToolCall.ID != "call_1" || tc.ToolCall.Name != "f" {
		t.Errorf("tool call chunk = %+v", tc)
	}
	if string(tc.ToolCall.Arguments) != `{"a"` {
		t.Errorf("arguments fragment = %s", tc.ToolCall.Arguments)
	}
	if state.MessageID != "chatcmpl-s" {
		t.Errorf("state.MessageID = %q", state.MessageID)
	}
}

func TestParseStreamEventFinishAndUsage(t *testing.T) {
	codec := OpenAICodec{}
	chunks, err := codec.ParseStreamEvent("", []byte(`{
		"choices":[{"index":0,"delta":{},"finish_reason":"length"}],
		"usage":{"prompt_tokens":7,"completion_tokens":2,"total_tokens":9,
			"prompt_tokens_details":{"cached_tokens":3},
			"completion_tokens_details":{"reasoning_tokens":1}}
	}`), &StreamState{})
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 {
		t.Fatalf("chunks = %+v", chunks)
	}
	if chunks[0].Type != core.ChunkFinish || chunks[0].FinishReason != core.FinishLength {
		t.Errorf("finish chunk = %+v", chunks[0])
	}
	if chunks[1].Type != core.ChunkUsage || chunks[1].Usage == nil {
		t.Fatalf("usage chunk = %+v", chunks[1])
	}
	if chunks[1].Usage.PromptTokens != 7 || chunks[1].Usage.CachedTokens != 3 || chunks[1].Usage.ReasoningTokens != 1 {
		t.Errorf("usage = %+v", *chunks[1].Usage)
	}
}

func TestParseStreamEventUsageOnly(t *testing.T) {
	chunks, err := OpenAICodec{}.ParseStreamEvent("", []byte(`{"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`), &StreamState{})
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 || chunks[0].Type != core.ChunkUsage {
		t.Fatalf("chunks = %+v", chunks)
	}
}

func TestParseStreamEventError(t *testing.T) {
	chunks, err := OpenAICodec{}.ParseStreamEvent("", []byte(`{"error":{"type":"CreditsError","message":"Insufficient balance","code":"insufficient_quota"}}`), &StreamState{})
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 || chunks[0].Type != core.ChunkError {
		t.Fatalf("chunks = %+v", chunks)
	}
	pe := core.AsProviderError(chunks[0].Err)
	if pe == nil || pe.Kind != core.ErrUpstream {
		t.Fatalf("err = %+v", chunks[0].Err)
	}
	if !strings.Contains(pe.Message, "Insufficient balance") {
		t.Errorf("message = %q", pe.Message)
	}
}

func TestParseStreamEventRateLimitError(t *testing.T) {
	chunks, err := OpenAICodec{}.ParseStreamEvent("", []byte(`{"error":{"type":"RateLimitError","message":"rate limit exceeded"}}`), &StreamState{})
	if err != nil {
		t.Fatal(err)
	}
	if pe := core.AsProviderError(chunks[0].Err); pe == nil || pe.Kind != core.ErrRateLimit {
		t.Fatalf("kind = %+v", pe)
	}
}

func TestParseStreamEventInvalidJSON(t *testing.T) {
	if _, err := (OpenAICodec{}).ParseStreamEvent("", []byte(`{oops`), &StreamState{}); err == nil {
		t.Error("expected error")
	}
}

// decodeEvents parses rendered SSE bytes into their JSON payloads (or the raw
// string for "[DONE]").
func decodeEvents(t *testing.T, events [][]byte) []any {
	t.Helper()
	var out []any
	for _, ev := range events {
		s := string(ev)
		if !strings.HasPrefix(s, "data: ") || !strings.HasSuffix(s, "\n\n") {
			t.Fatalf("malformed SSE event: %q", s)
		}
		if strings.Contains(s, "\nevent:") || strings.HasPrefix(s, "event:") {
			t.Fatalf("chunk events must not carry an event name: %q", s)
		}
		payload := strings.TrimSuffix(strings.TrimPrefix(s, "data: "), "\n\n")
		if payload == "[DONE]" {
			out = append(out, "[DONE]")
			continue
		}
		var v any
		if err := json.Unmarshal([]byte(payload), &v); err != nil {
			t.Fatalf("invalid JSON payload %q: %v", payload, err)
		}
		out = append(out, v)
	}
	return out
}

func TestRenderStreamChunkSequence(t *testing.T) {
	codec := OpenAICodec{}
	state := &StreamState{Model: "gpt-4o", MessageID: "chatcmpl-fixed"}

	var events [][]byte
	emit := func(chunk core.StreamChunk) {
		t.Helper()
		evs, err := codec.RenderStreamChunk(chunk, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%+v): %v", chunk, err)
		}
		events = append(events, evs...)
	}

	emit(core.StreamChunk{Type: core.ChunkThinking, Delta: "think"})
	emit(core.StreamChunk{Type: core.ChunkText, Delta: "he"})
	emit(core.StreamChunk{Type: core.ChunkText, Delta: "llo"})
	emit(core.StreamChunk{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_1", Name: "f"}})
	emit(core.StreamChunk{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"a":1}`)}})
	emit(core.StreamChunk{Type: core.ChunkFinish, FinishReason: core.FinishToolCalls})
	emit(core.StreamChunk{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 3, CompletionTokens: 4, TotalTokens: 7}})
	events = append(events, codec.RenderStreamDone(state)...)

	payloads := decodeEvents(t, events)
	if len(payloads) != 8 {
		t.Fatalf("event count = %d: %#v", len(payloads), payloads)
	}
	if payloads[len(payloads)-1] != "[DONE]" {
		t.Fatalf("last event = %#v, want [DONE]", payloads[len(payloads)-1])
	}

	chunkOf := func(i int) (map[string]any, []any) {
		m := payloads[i].(map[string]any)
		if m["object"] != "chat.completion.chunk" {
			t.Errorf("event %d object = %v", i, m["object"])
		}
		if m["id"] != "chatcmpl-fixed" {
			t.Errorf("event %d id = %v", i, m["id"])
		}
		choices, _ := m["choices"].([]any)
		return m, choices
	}

	// First event carries the assistant role and the thinking delta.
	_, choices := chunkOf(0)
	delta := choices[0].(map[string]any)["delta"].(map[string]any)
	if delta["role"] != "assistant" {
		t.Errorf("first delta role = %v", delta["role"])
	}
	if delta["reasoning_content"] != "think" {
		t.Errorf("thinking delta = %#v", delta)
	}

	// Later events must not repeat the role.
	for i := 1; i < 6; i++ {
		_, ch := chunkOf(i)
		d := ch[0].(map[string]any)["delta"].(map[string]any)
		if _, ok := d["role"]; ok {
			t.Errorf("event %d repeats role", i)
		}
	}

	_, choices = chunkOf(1)
	if choices[0].(map[string]any)["delta"].(map[string]any)["content"] != "he" {
		t.Errorf("event 1 = %#v", payloads[1])
	}

	// Tool call opener then argument fragment, sharing one id.
	_, choices = chunkOf(3)
	tcs := choices[0].(map[string]any)["delta"].(map[string]any)["tool_calls"].([]any)
	first := tcs[0].(map[string]any)
	if first["index"] != float64(0) || first["id"] != "call_1" || first["type"] != "function" {
		t.Errorf("tool call opener = %#v", first)
	}
	if first["function"].(map[string]any)["arguments"] != "" {
		t.Errorf("opener arguments = %#v", first["function"])
	}
	_, choices = chunkOf(4)
	tcs = choices[0].(map[string]any)["delta"].(map[string]any)["tool_calls"].([]any)
	second := tcs[0].(map[string]any)
	if second["id"] != "call_1" {
		t.Errorf("fragment id = %v, want call_1", second["id"])
	}
	if second["function"].(map[string]any)["arguments"] != `{"a":1}` {
		t.Errorf("fragment arguments = %#v", second["function"])
	}

	// Finish chunk.
	_, choices = chunkOf(5)
	if choices[0].(map[string]any)["finish_reason"] != "tool_calls" {
		t.Errorf("finish chunk = %#v", payloads[5])
	}

	// Usage chunk: empty choices, usage present, after the finish.
	usagePayload, choices := chunkOf(6)
	if len(choices) != 0 {
		t.Errorf("usage chunk choices = %#v", choices)
	}
	usage := usagePayload["usage"].(map[string]any)
	if usage["prompt_tokens"] != float64(3) || usage["total_tokens"] != float64(7) {
		t.Errorf("usage = %#v", usage)
	}
}

// Anthropic-sourced streams report input tokens before any content and output
// tokens at the end; the client must still see exactly one merged usage chunk,
// after the finish and before [DONE].
func TestRenderStreamUsageSplitAcrossEvents(t *testing.T) {
	codec := OpenAICodec{}
	state := &StreamState{Model: "m"}
	var events [][]byte
	for _, ch := range []core.StreamChunk{
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 20}},
		{Type: core.ChunkText, Delta: "hi"},
		{Type: core.ChunkFinish, FinishReason: core.FinishStop},
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 20, CompletionTokens: 6}},
	} {
		evs, err := codec.RenderStreamChunk(ch, state)
		if err != nil {
			t.Fatal(err)
		}
		events = append(events, evs...)
	}
	events = append(events, codec.RenderStreamDone(state)...)

	payloads := decodeEvents(t, events)
	if len(payloads) != 4 {
		t.Fatalf("events = %#v, want text, finish, usage, [DONE]", payloads)
	}
	usages := 0
	for _, p := range payloads {
		if m, ok := p.(map[string]any); ok && m["usage"] != nil {
			usages++
		}
	}
	if usages != 1 {
		t.Fatalf("usage chunks = %d, want 1", usages)
	}
	usage := payloads[2].(map[string]any)["usage"].(map[string]any)
	if usage["prompt_tokens"] != float64(20) || usage["completion_tokens"] != float64(6) || usage["total_tokens"] != float64(26) {
		t.Errorf("usage = %#v", usage)
	}
}

func TestRenderStreamDoneWithoutFinish(t *testing.T) {
	cases := []struct {
		name       string
		chunks     []core.StreamChunk
		wantFinish string
	}{
		{name: "text only", chunks: []core.StreamChunk{{Type: core.ChunkText, Delta: "hi"}}, wantFinish: "stop"},
		{
			name: "tool calls",
			chunks: []core.StreamChunk{
				{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_1", Name: "f"}},
			},
			wantFinish: "tool_calls",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			codec := OpenAICodec{}
			state := &StreamState{Model: "m"}
			var events [][]byte
			for _, c := range tc.chunks {
				evs, err := codec.RenderStreamChunk(c, state)
				if err != nil {
					t.Fatal(err)
				}
				events = append(events, evs...)
			}
			events = append(events, codec.RenderStreamDone(state)...)
			payloads := decodeEvents(t, events)
			if len(payloads) != 3 {
				t.Fatalf("events = %#v", payloads)
			}
			last := payloads[1].(map[string]any)["choices"].([]any)[0].(map[string]any)
			if last["finish_reason"] != tc.wantFinish {
				t.Errorf("finish_reason = %v, want %q", last["finish_reason"], tc.wantFinish)
			}
			if payloads[2] != "[DONE]" {
				t.Errorf("terminal = %#v", payloads[2])
			}
		})
	}
}

func TestRenderStreamDoneAfterFinishEmitsOnlyDone(t *testing.T) {
	codec := OpenAICodec{}
	state := &StreamState{Model: "m"}
	evs, err := codec.RenderStreamChunk(core.StreamChunk{Type: core.ChunkFinish, FinishReason: core.FinishStop}, state)
	if err != nil {
		t.Fatal(err)
	}
	evs = append(evs, codec.RenderStreamDone(state)...)
	payloads := decodeEvents(t, evs)
	if len(payloads) != 2 {
		t.Fatalf("events = %#v", payloads)
	}
	if payloads[1] != "[DONE]" {
		t.Errorf("terminal = %#v", payloads[1])
	}
}

func TestRenderStreamChunkError(t *testing.T) {
	evs, err := OpenAICodec{}.RenderStreamChunk(core.StreamChunk{
		Type: core.ChunkError,
		Err:  core.NewProviderError(core.ErrRateLimit, "slow down"),
	}, &StreamState{Model: "m"})
	if err != nil {
		t.Fatal(err)
	}
	payloads := decodeEvents(t, evs)
	if len(payloads) != 1 {
		t.Fatalf("events = %#v", payloads)
	}
	e := payloads[0].(map[string]any)["error"].(map[string]any)
	if e["message"] != "slow down" || e["type"] != "rate_limit" {
		t.Errorf("error event = %#v", e)
	}
}

func TestRenderStreamChunkIgnoresUnknownTypes(t *testing.T) {
	evs, err := OpenAICodec{}.RenderStreamChunk(core.StreamChunk{Type: core.ChunkPing}, &StreamState{})
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 0 {
		t.Errorf("events = %#v", evs)
	}
}

func TestRenderStreamGeneratesMessageIDWhenAbsent(t *testing.T) {
	state := &StreamState{Model: "m"}
	evs, err := OpenAICodec{}.RenderStreamChunk(core.StreamChunk{Type: core.ChunkText, Delta: "a"}, state)
	if err != nil {
		t.Fatal(err)
	}
	payloads := decodeEvents(t, evs)
	id := payloads[0].(map[string]any)["id"].(string)
	if !strings.HasPrefix(id, "chatcmpl-") || len(id) <= len("chatcmpl-") {
		t.Errorf("generated id = %q", id)
	}
	if state.MessageID != id {
		t.Errorf("state.MessageID = %q, want %q", state.MessageID, id)
	}
}

func TestStreamRoundTripThroughRenderer(t *testing.T) {
	// Upstream chunk -> canonical chunks -> client SSE events.
	upstream := `{"id":"chatcmpl-up","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":null}]}`
	state := &StreamState{Model: "gpt-4o"}
	chunks, err := OpenAICodec{}.ParseStreamEvent("", []byte(upstream), state)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 1 || chunks[0].Type != core.ChunkText {
		t.Fatalf("chunks = %+v", chunks)
	}
	clientState := &StreamState{Model: "gpt-4o"}
	var events [][]byte
	for _, c := range chunks {
		evs, err := OpenAICodec{}.RenderStreamChunk(c, clientState)
		if err != nil {
			t.Fatal(err)
		}
		events = append(events, evs...)
	}
	events = append(events, OpenAICodec{}.RenderStreamDone(clientState)...)
	payloads := decodeEvents(t, events)
	if len(payloads) != 3 {
		t.Fatalf("events = %#v", payloads)
	}
	delta := payloads[0].(map[string]any)["choices"].([]any)[0].(map[string]any)["delta"].(map[string]any)
	if delta["role"] != "assistant" || delta["content"] != "hi" {
		t.Errorf("delta = %#v", delta)
	}
	if payloads[2] != "[DONE]" {
		t.Errorf("terminal = %#v", payloads[2])
	}
}
