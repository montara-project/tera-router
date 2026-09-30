package transform

import (
	"encoding/json"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

// ---- helpers ----------------------------------------------------------------

func respParse(t *testing.T, body string) *core.ChatRequest {
	t.Helper()
	req, err := OpenAIResponsesCodec{}.ParseRequest([]byte(body))
	if err != nil {
		t.Fatalf("ParseRequest(%s) error: %v", body, err)
	}
	return req
}

func respRender(t *testing.T, req *core.ChatRequest, providerID string) map[string]any {
	t.Helper()
	body, err := OpenAIResponsesCodec{}.RenderRequest(req, providerID)
	if err != nil {
		t.Fatalf("RenderRequest(%s) error: %v", providerID, err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("RenderRequest produced invalid JSON (%s): %v", body, err)
	}
	return out
}

// respEvent is one parsed client-facing SSE event.
type respEvent struct {
	Name    string
	Payload map[string]any
}

// respParseEvents decodes the "event: <name>\ndata: <json>\n\n" events a codec
// emits for a Responses client.
func respParseEvents(t *testing.T, raw [][]byte) []respEvent {
	t.Helper()
	var out []respEvent
	for _, ev := range raw {
		s := string(ev)
		if !strings.HasPrefix(s, "event: ") {
			t.Fatalf("event missing name line: %q", s)
		}
		if !strings.HasSuffix(s, "\n\n") {
			t.Fatalf("event missing trailing blank line: %q", s)
		}
		lines := strings.SplitN(strings.TrimSuffix(s, "\n\n"), "\n", 2)
		name := strings.TrimPrefix(lines[0], "event: ")
		if len(lines) < 2 || !strings.HasPrefix(lines[1], "data: ") {
			t.Fatalf("event %q missing data line: %q", name, s)
		}
		var payload map[string]any
		if err := json.Unmarshal([]byte(strings.TrimPrefix(lines[1], "data: ")), &payload); err != nil {
			t.Fatalf("event %q has invalid JSON payload: %v", name, err)
		}
		if got, _ := payload["type"].(string); got != name {
			t.Fatalf("event %q payload type = %v", name, payload["type"])
		}
		out = append(out, respEvent{Name: name, Payload: payload})
	}
	return out
}

func respEventNames(events []respEvent) []string {
	names := make([]string, 0, len(events))
	for _, ev := range events {
		names = append(names, ev.Name)
	}
	return names
}

// respFindEvent returns the first event with the given name.
func respFindEvent(t *testing.T, events []respEvent, name string) map[string]any {
	t.Helper()
	for _, ev := range events {
		if ev.Name == name {
			return ev.Payload
		}
	}
	t.Fatalf("event %q not found in %v", name, respEventNames(events))
	return nil
}

// respIndexOf returns the position of the first event with the given name.
func respIndexOf(t *testing.T, events []respEvent, name string) int {
	t.Helper()
	for i, ev := range events {
		if ev.Name == name {
			return i
		}
	}
	t.Fatalf("event %q not found in %v", name, respEventNames(events))
	return -1
}

func respInput(t *testing.T, rendered map[string]any) []map[string]any {
	t.Helper()
	raw, ok := rendered["input"].([]any)
	if !ok {
		t.Fatalf("rendered request has no input array: %v", rendered)
	}
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		obj, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("input item is not an object: %v", item)
		}
		out = append(out, obj)
	}
	return out
}

func respRenderChunks(t *testing.T, state *StreamState, chunks ...core.StreamChunk) []respEvent {
	t.Helper()
	codec := OpenAIResponsesCodec{}
	var raw [][]byte
	for _, c := range chunks {
		evs, err := codec.RenderStreamChunk(c, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%+v) error: %v", c, err)
		}
		raw = append(raw, evs...)
	}
	return respParseEvents(t, raw)
}

// ---- request parsing --------------------------------------------------------

func TestResponsesParseRequestInputItems(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5-codex",
		"stream": true,
		"instructions": "be precise",
		"temperature": 0.7,
		"top_p": 0.9,
		"max_output_tokens": 4096,
		"reasoning": {"effort": "high", "summary": "auto"},
		"tool_choice": {"type": "function", "name": "get_weather"},
		"text": {"format": {"type": "json_schema", "name": "out", "schema": {"type": "object"}}},
		"store": false,
		"include": ["reasoning.encrypted_content"],
		"service_tier": "auto",
		"prompt_cache_key": "abc",
		"parallel_tool_calls": true,
		"previous_response_id": "resp_prev",
		"metadata": {"k": "v"},
		"truncation": "auto",
		"user": "u1",
		"input": [
			{"type": "message", "role": "user", "content": [{"type": "input_text", "text": "hello"}]},
			{"type": "function_call", "call_id": "call_1", "name": "get_weather", "arguments": "{\"city\":\"SF\"}"},
			{"type": "function_call_output", "call_id": "call_1", "output": "sunny"}
		],
		"tools": [
			{"type": "function", "name": "get_weather", "description": "weather", "parameters": {"type": "object", "properties": {}}},
			{"type": "function", "function": {"name": "nested", "description": "nested tool", "parameters": {"type": "object"}}},
			{"type": "web_search"}
		]
	}`)

	if req.Model != "gpt-5-codex" || !req.Stream {
		t.Fatalf("model/stream = %q/%v", req.Model, req.Stream)
	}
	if req.System != "be precise" {
		t.Errorf("System = %q", req.System)
	}
	if req.Temperature == nil || *req.Temperature != 0.7 || req.TopP == nil || *req.TopP != 0.9 {
		t.Errorf("temperature/top_p = %v/%v", req.Temperature, req.TopP)
	}
	if req.MaxTokens == nil || *req.MaxTokens != 4096 {
		t.Errorf("MaxTokens = %v", req.MaxTokens)
	}
	if req.Reasoning == nil || req.Reasoning.Effort != "high" {
		t.Errorf("Reasoning = %+v", req.Reasoning)
	}
	if req.ToolChoice == nil || req.ToolChoice.Mode != "function" || req.ToolChoice.Name != "get_weather" {
		t.Errorf("ToolChoice = %+v", req.ToolChoice)
	}
	if !strings.Contains(string(req.ResponseFormat), `"json_schema"`) {
		t.Errorf("ResponseFormat = %s", req.ResponseFormat)
	}
	// Hosted tools are not functions and must not become canonical tools.
	if len(req.Tools) != 2 || req.Tools[0].Name != "get_weather" || req.Tools[1].Name != "nested" {
		t.Fatalf("Tools = %+v", req.Tools)
	}
	if req.Tools[1].Description != "nested tool" {
		t.Errorf("nested tool description = %q", req.Tools[1].Description)
	}

	// user message + assistant(tool_call) + tool(result)
	if len(req.Messages) != 3 {
		t.Fatalf("messages = %d (%+v)", len(req.Messages), req.Messages)
	}
	if req.Messages[0].Role != core.RoleUser || req.Messages[0].TextContent() != "hello" {
		t.Errorf("message[0] = %+v", req.Messages[0])
	}
	tc := req.Messages[1].Content[0]
	if req.Messages[1].Role != core.RoleAssistant || tc.Type != core.PartToolCall {
		t.Fatalf("message[1] = %+v", req.Messages[1])
	}
	if tc.ToolCall.ID != "call_1" || tc.ToolCall.Name != "get_weather" || string(tc.ToolCall.Arguments) != `{"city":"SF"}` {
		t.Errorf("tool call = %+v", tc.ToolCall)
	}
	res := req.Messages[2].Content[0]
	if req.Messages[2].Role != core.RoleTool || res.Type != core.PartToolResult {
		t.Fatalf("message[2] = %+v", req.Messages[2])
	}
	if res.ToolResult.CallID != "call_1" || res.ToolResult.Content != "sunny" {
		t.Errorf("tool result = %+v", res.ToolResult)
	}

	// Allowlisted passthrough fields survive in Extra.
	for _, key := range []string{
		"store", "include", "service_tier", "prompt_cache_key", "parallel_tool_calls",
		"previous_response_id", "metadata", "truncation", "user",
	} {
		if _, ok := req.Extra[key]; !ok {
			t.Errorf("Extra[%q] missing", key)
		}
	}
	if _, ok := req.Extra["tools_builtin"]; !ok {
		t.Errorf("Extra[tools_builtin] missing (hosted web_search should be preserved)")
	}
	if _, ok := req.Extra["instructions"]; ok {
		t.Errorf("Extra must not carry modelled fields: %v", req.Extra)
	}
}

func TestResponsesParseRequestStringInput(t *testing.T) {
	req := respParse(t, `{"model":"gpt-5","input":"just a prompt"}`)
	if len(req.Messages) != 1 || req.Messages[0].Role != core.RoleUser {
		t.Fatalf("messages = %+v", req.Messages)
	}
	if got := req.Messages[0].TextContent(); got != "just a prompt" {
		t.Errorf("text = %q", got)
	}
}

func TestResponsesParseRequestMergesConsecutiveItems(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5",
		"input": [
			{"type": "message", "role": "user", "content": "do both"},
			{"type": "function_call", "call_id": "c1", "name": "a", "arguments": "{}"},
			{"type": "function_call", "call_id": "c2", "name": "b", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "c1", "output": "r1"},
			{"type": "function_call_output", "call_id": "c2", "output": {"ok": true}}
		]
	}`)
	if len(req.Messages) != 3 {
		t.Fatalf("messages = %d (%+v)", len(req.Messages), req.Messages)
	}
	if got := len(req.Messages[1].Content); got != 2 {
		t.Fatalf("assistant tool calls = %d", got)
	}
	if req.Messages[1].Content[1].ToolCall.Name != "b" {
		t.Errorf("second tool call = %+v", req.Messages[1].Content[1].ToolCall)
	}
	if got := len(req.Messages[2].Content); got != 2 {
		t.Fatalf("tool results = %d", got)
	}
	// A structured (non-string) output is preserved as its JSON text.
	if got := req.Messages[2].Content[1].ToolResult.Content; got != `{"ok": true}` {
		t.Errorf("second tool result = %q", got)
	}
}

func TestResponsesParseRequestSystemHoisting(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5",
		"input": [
			{"type": "message", "role": "developer", "content": "dev rules"},
			{"type": "message", "role": "system", "content": [{"type": "input_text", "text": "sys rules"}]},
			{"role": "user", "content": [{"type": "input_text", "text": "hi"}]}
		]
	}`)
	if req.System != "dev rules\n\nsys rules" {
		t.Errorf("System = %q", req.System)
	}
	if len(req.Messages) != 1 || req.Messages[0].Role != core.RoleUser {
		t.Fatalf("messages = %+v", req.Messages)
	}
}

func TestResponsesParseRequestImages(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5",
		"input": [{"type": "message", "role": "user", "content": [
			{"type": "input_text", "text": "what is this"},
			{"type": "input_image", "image_url": "https://example.com/a.png"},
			{"type": "input_image", "image_url": {"url": "data:image/png;base64,QUJD"}}
		]}]
	}`)
	parts := req.Messages[0].Content
	if len(parts) != 3 {
		t.Fatalf("parts = %+v", parts)
	}
	if parts[1].Type != core.PartImage || parts[1].Media.URL != "https://example.com/a.png" {
		t.Errorf("remote image = %+v", parts[1].Media)
	}
	if parts[2].Media.MIMEType != "image/png" || parts[2].Media.Data != "QUJD" {
		t.Errorf("data uri image = %+v", parts[2].Media)
	}
}

func TestResponsesParseRequestReasoningRoundTrip(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5-codex",
		"instructions": "be precise",
		"input": [
			{"type": "message", "role": "user", "content": [{"type": "input_text", "text": "what is 2+2?"}]},
			{"type": "reasoning", "encrypted_content": "enc_abc", "summary": [{"type": "summary_text", "text": "thinking about math"}]},
			{"type": "function_call", "call_id": "call_1", "name": "calculator", "arguments": "{\"expr\":\"2+2\"}"},
			{"type": "function_call_output", "call_id": "call_1", "output": "4"},
			{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "The answer is 4."}]}
		]
	}`)

	// The reasoning item is attached to the assistant turn that follows it.
	if len(req.Messages) != 4 {
		t.Fatalf("messages = %d (%+v)", len(req.Messages), req.Messages)
	}
	think := req.Messages[1].Content[0]
	if think.Type != core.PartThinking || think.Text != "thinking about math" || think.Signature != "enc_abc" {
		t.Fatalf("thinking part = %+v", think)
	}

	rendered := respRender(t, req, "custom-responses")
	if rendered["instructions"] != "be precise" {
		t.Errorf("instructions = %v", rendered["instructions"])
	}
	items := respInput(t, rendered)
	var reasoning, call, output, message map[string]any
	for _, item := range items {
		switch item["type"] {
		case "reasoning":
			reasoning = item
		case "function_call":
			call = item
		case "function_call_output":
			output = item
		case "message":
			if item["role"] == "assistant" {
				message = item
			}
		}
	}
	if reasoning == nil || reasoning["encrypted_content"] != "enc_abc" {
		t.Fatalf("rendered reasoning = %+v", reasoning)
	}
	summary, _ := reasoning["summary"].([]any)
	if len(summary) != 1 {
		t.Fatalf("rendered reasoning summary = %+v", reasoning["summary"])
	}
	if call == nil || call["call_id"] != "call_1" || call["name"] != "calculator" {
		t.Fatalf("rendered function_call = %+v", call)
	}
	if output == nil || output["call_id"] != "call_1" || output["output"] != "4" {
		t.Fatalf("rendered function_call_output = %+v", output)
	}
	if message == nil {
		t.Fatalf("rendered assistant message missing: %+v", items)
	}
	content, _ := message["content"].([]any)
	if len(content) != 1 || content[0].(map[string]any)["type"] != "output_text" {
		t.Errorf("assistant content = %+v", message["content"])
	}
}

func TestResponsesParseRequestReasoningEncryptedOnly(t *testing.T) {
	req := respParse(t, `{
		"model": "gpt-5-codex",
		"input": [
			{"type": "message", "role": "user", "content": "hi"},
			{"type": "reasoning", "encrypted_content": "enc_xyz"},
			{"type": "function_call", "call_id": "c2", "name": "search", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "c2", "output": "results"}
		]
	}`)
	think := req.Messages[1].Content[0]
	if think.Type != core.PartThinking || think.Signature != "enc_xyz" || think.Text != "" {
		t.Fatalf("thinking = %+v", think)
	}
	rendered := respRender(t, req, "openai")
	var found bool
	for _, item := range respInput(t, rendered) {
		if item["type"] == "reasoning" {
			found = true
			if item["encrypted_content"] != "enc_xyz" {
				t.Errorf("encrypted_content = %v", item["encrypted_content"])
			}
		}
	}
	if !found {
		t.Errorf("encrypted-only reasoning was dropped: %+v", rendered["input"])
	}
}

func TestResponsesParseRequestErrors(t *testing.T) {
	if _, err := (OpenAIResponsesCodec{}).ParseRequest([]byte(`{"model":`)); err == nil {
		t.Error("malformed JSON must error")
	}
	if _, err := (OpenAIResponsesCodec{}).ParseRequest([]byte(`{"model":"m","input":{"a":1}}`)); err == nil {
		t.Error("non-string non-array input must error")
	}
}

// ---- request rendering ------------------------------------------------------

func TestResponsesRenderRequestShape(t *testing.T) {
	maxTokens, temp, topP := 512, 0.3, 0.8
	req := &core.ChatRequest{
		Model:       "gpt-5-codex",
		System:      "sys",
		Stream:      true,
		MaxTokens:   &maxTokens,
		Temperature: &temp,
		TopP:        &topP,
		ToolChoice:  &core.ToolChoice{Mode: "required"},
		Reasoning:   &core.ReasoningConfig{Effort: "medium"},
		Messages: []core.Message{
			{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}},
			{Role: core.RoleAssistant, Content: []core.ContentPart{
				{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "c1", Name: "f", Arguments: json.RawMessage(`{"a":1}`)}},
			}},
			{Role: core.RoleTool, Content: []core.ContentPart{
				{Type: core.PartToolResult, ToolResult: &core.ToolResult{CallID: "c1", Content: "out"}},
			}},
		},
		Tools: []core.Tool{{Name: "f", Description: "d"}},
	}

	rendered := respRender(t, req, "openai")
	if rendered["model"] != "gpt-5-codex" || rendered["instructions"] != "sys" {
		t.Errorf("model/instructions = %v/%v", rendered["model"], rendered["instructions"])
	}
	if rendered["stream"] != true || rendered["store"] != false {
		t.Errorf("stream/store = %v/%v", rendered["stream"], rendered["store"])
	}
	if rendered["max_output_tokens"] != float64(512) {
		t.Errorf("max_output_tokens = %v", rendered["max_output_tokens"])
	}
	if rendered["tool_choice"] != "required" {
		t.Errorf("tool_choice = %v", rendered["tool_choice"])
	}
	reasoning, _ := rendered["reasoning"].(map[string]any)
	if reasoning["effort"] != "medium" {
		t.Errorf("reasoning = %v", rendered["reasoning"])
	}
	tools, _ := rendered["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("tools = %v", rendered["tools"])
	}
	tool := tools[0].(map[string]any)
	if tool["type"] != "function" || tool["name"] != "f" || tool["description"] != "d" {
		t.Errorf("tool = %v", tool)
	}
	if tool["parameters"] == nil {
		t.Errorf("tool parameters must default to a schema: %v", tool)
	}

	items := respInput(t, rendered)
	if len(items) != 3 {
		t.Fatalf("input = %+v", items)
	}
	if items[0]["type"] != "message" || items[0]["role"] != "user" {
		t.Errorf("input[0] = %+v", items[0])
	}
	if items[1]["type"] != "function_call" || items[1]["arguments"] != `{"a":1}` {
		t.Errorf("input[1] = %+v", items[1])
	}
	if items[2]["type"] != "function_call_output" || items[2]["output"] != "out" {
		t.Errorf("input[2] = %+v", items[2])
	}

	// Chat Completions knobs must never leak onto this wire.
	for _, key := range []string{"temperature", "top_p", "max_tokens", "max_completion_tokens", "messages"} {
		if _, ok := rendered[key]; ok {
			t.Errorf("%s must not be rendered for the Responses API", key)
		}
	}
	for key := range rendered {
		if !responsesAPIAllowlist[key] {
			t.Errorf("rendered unknown field %q", key)
		}
	}
}

func TestResponsesRenderRequestCodexDropsMaxOutputTokens(t *testing.T) {
	maxTokens := 1024
	req := &core.ChatRequest{
		Model:     "gpt-5-codex",
		MaxTokens: &maxTokens,
		Messages:  []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}},
	}
	if _, ok := respRender(t, req, "codex")["max_output_tokens"]; ok {
		t.Error("codex rejects max_output_tokens; it must be omitted")
	}
	if respRender(t, req, "openai")["max_output_tokens"] != float64(1024) {
		t.Error("max_output_tokens must be rendered for non-codex providers")
	}
}

func TestResponsesRenderRequestExtraAllowlist(t *testing.T) {
	req := &core.ChatRequest{
		Model:    "gpt-5",
		Messages: []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}},
		Extra: map[string]json.RawMessage{
			"include":       json.RawMessage(`["reasoning.encrypted_content"]`),
			"service_tier":  json.RawMessage(`"flex"`),
			"stream":        json.RawMessage(`false`), // never overrides the modelled field
			"tools_builtin": json.RawMessage(`[{"type":"web_search"}]`),
			"tenant_id":     json.RawMessage(`"t1"`), // not a Responses field
			"temperature":   json.RawMessage(`0.9`),  // Chat Completions field
		},
	}
	rendered := respRender(t, req, "openai")
	if rendered["service_tier"] != "flex" {
		t.Errorf("service_tier = %v", rendered["service_tier"])
	}
	if rendered["stream"] != false {
		t.Errorf("stream = %v", rendered["stream"])
	}
	for _, key := range []string{"tenant_id", "temperature"} {
		if _, ok := rendered[key]; ok {
			t.Errorf("non-allowlisted Extra field %q leaked through", key)
		}
	}
	include, _ := rendered["include"].([]any)
	if len(include) != 1 || include[0] != "reasoning.encrypted_content" {
		t.Errorf("include = %v", rendered["include"])
	}
	tools, _ := rendered["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("builtin tools = %v", rendered["tools"])
	}
	if tools[0].(map[string]any)["type"] != "web_search" {
		t.Errorf("builtin tool = %v", tools[0])
	}
}

func TestResponsesRenderRequestTextFormat(t *testing.T) {
	req := &core.ChatRequest{
		Model:    "gpt-5",
		Messages: []core.Message{{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: "hi"}}}},
		// Chat Completions nests the schema definition under json_schema.
		ResponseFormat: json.RawMessage(`{"type":"json_schema","json_schema":{"name":"out","schema":{"type":"object"},"strict":true}}`),
	}
	text, _ := respRender(t, req, "openai")["text"].(map[string]any)
	format, _ := text["format"].(map[string]any)
	if format == nil {
		t.Fatalf("text.format missing: %v", text)
	}
	if format["type"] != "json_schema" || format["name"] != "out" || format["strict"] != true {
		t.Errorf("format = %v", format)
	}
	if _, ok := format["schema"].(map[string]any); !ok {
		t.Errorf("format schema = %v", format["schema"])
	}
}

func TestResponsesRenderRequestTextObjectPassthrough(t *testing.T) {
	// A Responses client's `text` object (verbosity, ...) must survive the
	// round trip while the canonical json_schema format is re-imposed.
	req := respParse(t, `{
		"model": "gpt-5",
		"input": "hi",
		"text": {"format": {"type": "json_schema", "name": "out", "schema": {"type": "object"}}, "verbosity": "low"}
	}`)
	if !strings.Contains(string(req.ResponseFormat), `"json_schema"`) {
		t.Fatalf("ResponseFormat = %s", req.ResponseFormat)
	}
	text, _ := respRender(t, req, "openai")["text"].(map[string]any)
	if text["verbosity"] != "low" {
		t.Errorf("verbosity passthrough lost: %v", text)
	}
	format, _ := text["format"].(map[string]any)
	if format["type"] != "json_schema" || format["name"] != "out" {
		t.Errorf("format = %v", format)
	}
}

func TestResponsesRenderRequestImagesAndThinking(t *testing.T) {
	req := &core.ChatRequest{
		Model: "gpt-5",
		Messages: []core.Message{
			{Role: core.RoleUser, Content: []core.ContentPart{
				{Type: core.PartText, Text: "look"},
				{Type: core.PartImage, Media: &core.MediaPayload{MIMEType: "image/webp", Data: "QUJD"}},
			}},
			{Role: core.RoleAssistant, Content: []core.ContentPart{
				{Type: core.PartThinking, Text: "hmm", Signature: "enc"},
				{Type: core.PartText, Text: "seen"},
			}},
		},
	}
	items := respInput(t, respRender(t, req, "openai"))
	if len(items) != 3 {
		t.Fatalf("input = %+v", items)
	}
	userContent := items[0]["content"].([]any)
	image := userContent[1].(map[string]any)
	if image["type"] != "input_image" || image["image_url"] != "data:image/webp;base64,QUJD" {
		t.Errorf("image part = %v", image)
	}
	if items[1]["type"] != "reasoning" {
		t.Fatalf("reasoning must precede the assistant turn: %+v", items[1])
	}
	assistantContent := items[2]["content"].([]any)
	if assistantContent[0].(map[string]any)["type"] != "output_text" {
		t.Errorf("assistant part type = %v", assistantContent[0])
	}
}

func TestResponsesRenderRequestClampsCallIDAndInstructions(t *testing.T) {
	longID := strings.Repeat("x", 100)
	req := &core.ChatRequest{
		Model:  "gpt-5",
		System: strings.Repeat("s", respMaxInstructionsLen+10),
		Messages: []core.Message{
			{Role: core.RoleAssistant, Content: []core.ContentPart{
				{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: longID, Name: "f"}},
			}},
			{Role: core.RoleTool, Content: []core.ContentPart{
				{Type: core.PartToolResult, ToolResult: &core.ToolResult{CallID: longID, Content: "r"}},
			}},
		},
	}
	rendered := respRender(t, req, "openai")
	instructions := rendered["instructions"].(string)
	if len(instructions) > respMaxInstructionsLen {
		t.Errorf("instructions not clamped: %d bytes", len(instructions))
	}
	if !strings.HasSuffix(instructions, "[TRUNCATED: system prompt exceeded 1MB limit]") {
		t.Errorf("clamped instructions lack the marker: %q", instructions[len(instructions)-60:])
	}
	items := respInput(t, rendered)
	callID := items[0]["call_id"].(string)
	if len(callID) != respMaxCallIDLen {
		t.Errorf("call_id not clamped: %d chars", len(callID))
	}
	// The matching output must be clamped identically so the pair still lines up.
	if items[1]["call_id"] != callID {
		t.Errorf("clamped call_id mismatch: %v vs %v", items[1]["call_id"], callID)
	}
}

// ---- unary response ---------------------------------------------------------

func TestResponsesParseResponseUnary(t *testing.T) {
	body := []byte(`{
		"id": "resp_123",
		"status": "completed",
		"output": [
			{"type": "reasoning", "summary": [{"type": "summary_text", "text": "thinking"}], "encrypted_content": "enc"},
			{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "the answer"}]},
			{"type": "function_call", "call_id": "c1", "name": "f", "arguments": "{\"a\":1}"}
		],
		"usage": {
			"input_tokens": 10,
			"output_tokens": 5,
			"input_tokens_details": {"cached_tokens": 3},
			"output_tokens_details": {"reasoning_tokens": 2}
		}
	}`)
	resp, err := (OpenAIResponsesCodec{}).ParseResponse(body, "gpt-5-codex")
	if err != nil {
		t.Fatalf("ParseResponse error: %v", err)
	}
	if resp.ID != "resp_123" || resp.Model != "gpt-5-codex" {
		t.Errorf("id/model = %q/%q", resp.ID, resp.Model)
	}
	if resp.Message.Role != core.RoleAssistant {
		t.Errorf("role = %q", resp.Message.Role)
	}
	if len(resp.Message.Content) != 3 {
		t.Fatalf("content = %+v", resp.Message.Content)
	}
	if think := resp.Message.Content[0]; think.Type != core.PartThinking || think.Text != "thinking" || think.Signature != "enc" {
		t.Errorf("thinking = %+v", think)
	}
	if resp.Message.Content[1].Text != "the answer" {
		t.Errorf("text = %+v", resp.Message.Content[1])
	}
	if tc := resp.Message.Content[2].ToolCall; tc == nil || tc.ID != "c1" || string(tc.Arguments) != `{"a":1}` {
		t.Errorf("tool call = %+v", tc)
	}
	if resp.FinishReason != core.FinishToolCalls {
		t.Errorf("finish = %q", resp.FinishReason)
	}
	if resp.Usage.PromptTokens != 10 || resp.Usage.CompletionTokens != 5 || resp.Usage.TotalTokens != 15 {
		t.Errorf("usage = %+v", resp.Usage)
	}
	if resp.Usage.CachedTokens != 3 || resp.Usage.ReasoningTokens != 2 {
		t.Errorf("usage details = %+v", resp.Usage)
	}
}

func TestResponsesParseResponseFinishReasons(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	tests := []struct {
		name string
		body string
		want core.FinishReason
	}{
		{
			name: "plain completion",
			body: `{"output":[{"type":"message","content":[{"type":"output_text","text":"hi"}]}],"usage":{"input_tokens":1,"output_tokens":1}}`,
			want: core.FinishStop,
		},
		{
			name: "incomplete max output tokens",
			body: `{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[{"type":"message","content":[{"type":"output_text","text":"hi"}]}]}`,
			want: core.FinishLength,
		},
		{
			name: "incomplete content filter",
			body: `{"status":"incomplete","incomplete_details":{"reason":"content_filter"},"output":[]}`,
			want: core.FinishStop,
		},
		{
			name: "failed",
			body: `{"status":"failed","output":[]}`,
			want: core.FinishError,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := codec.ParseResponse([]byte(tc.body), "m")
			if err != nil {
				t.Fatalf("ParseResponse error: %v", err)
			}
			if resp.FinishReason != tc.want {
				t.Errorf("finish = %q, want %q", resp.FinishReason, tc.want)
			}
		})
	}

	if _, err := codec.ParseResponse([]byte(`{"output":`), "m"); err == nil {
		t.Error("malformed body must error")
	}
}

func TestResponsesRenderResponse(t *testing.T) {
	resp := &core.ChatResponse{
		ID:    "resp_abc",
		Model: "gpt-5-codex",
		Message: core.Message{Role: core.RoleAssistant, Content: []core.ContentPart{
			{Type: core.PartThinking, Text: "thinking", Signature: "enc"},
			{Type: core.PartText, Text: "the answer"},
			{Type: core.PartToolCall, ToolCall: &core.ToolCall{ID: "call_1", Name: "f", Arguments: json.RawMessage(`{"a":1}`)}},
		}},
		FinishReason: core.FinishToolCalls,
		Usage:        core.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15, CachedTokens: 3, ReasoningTokens: 2},
	}
	body, err := (OpenAIResponsesCodec{}).RenderResponse(resp)
	if err != nil {
		t.Fatalf("RenderResponse error: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("RenderResponse produced invalid JSON (%s): %v", body, err)
	}

	if out["id"] != "resp_abc" || out["object"] != "response" || out["status"] != "completed" {
		t.Errorf("envelope = %v", out)
	}
	if out["model"] != "gpt-5-codex" {
		t.Errorf("model = %v", out["model"])
	}
	if _, ok := out["created_at"].(float64); !ok {
		t.Errorf("created_at = %v", out["created_at"])
	}

	output, _ := out["output"].([]any)
	if len(output) != 3 {
		t.Fatalf("output = %+v", out["output"])
	}
	reasoning := output[0].(map[string]any)
	if reasoning["type"] != "reasoning" || reasoning["encrypted_content"] != "enc" {
		t.Errorf("reasoning item = %v", reasoning)
	}
	message := output[1].(map[string]any)
	if message["type"] != "message" || message["role"] != "assistant" || message["status"] != "completed" {
		t.Errorf("message item = %v", message)
	}
	if _, ok := message["id"].(string); !ok {
		t.Errorf("message item id = %v", message["id"])
	}
	content := message["content"].([]any)[0].(map[string]any)
	if content["type"] != "output_text" || content["text"] != "the answer" {
		t.Errorf("message content = %v", content)
	}
	if _, ok := content["annotations"].([]any); !ok {
		t.Errorf("output_text annotations = %v", content["annotations"])
	}
	call := output[2].(map[string]any)
	if call["type"] != "function_call" || call["call_id"] != "call_1" || call["name"] != "f" {
		t.Errorf("function_call item = %v", call)
	}
	if call["arguments"] != `{"a":1}` || call["status"] != "completed" {
		t.Errorf("function_call arguments/status = %v/%v", call["arguments"], call["status"])
	}

	usage := out["usage"].(map[string]any)
	if usage["input_tokens"] != float64(10) || usage["output_tokens"] != float64(5) || usage["total_tokens"] != float64(15) {
		t.Errorf("usage = %v", usage)
	}
	if usage["input_tokens_details"].(map[string]any)["cached_tokens"] != float64(3) {
		t.Errorf("usage input details = %v", usage["input_tokens_details"])
	}
	if usage["output_tokens_details"].(map[string]any)["reasoning_tokens"] != float64(2) {
		t.Errorf("usage output details = %v", usage["output_tokens_details"])
	}
}

func TestResponsesRenderResponseIncompleteAndGeneratedID(t *testing.T) {
	body, err := (OpenAIResponsesCodec{}).RenderResponse(&core.ChatResponse{
		Model:        "gpt-5",
		Message:      core.Message{Role: core.RoleAssistant, Content: []core.ContentPart{{Type: core.PartText, Text: "cut"}}},
		FinishReason: core.FinishLength,
	})
	if err != nil {
		t.Fatalf("RenderResponse error: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if out["status"] != "incomplete" {
		t.Errorf("status = %v", out["status"])
	}
	id, _ := out["id"].(string)
	if !strings.HasPrefix(id, "resp_") || len(id) <= len("resp_") {
		t.Errorf("generated id = %q", id)
	}
}

// ---- stream parsing ---------------------------------------------------------

func TestResponsesParseStreamEvent(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	tests := []struct {
		name      string
		event     string
		data      string
		wantTypes []core.ChunkType
		check     func(t *testing.T, chunks []core.StreamChunk)
	}{
		{
			name:      "output text delta",
			event:     "response.output_text.delta",
			data:      `{"type":"response.output_text.delta","delta":"hel"}`,
			wantTypes: []core.ChunkType{core.ChunkText},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				if chunks[0].Delta != "hel" {
					t.Errorf("delta = %q", chunks[0].Delta)
				}
			},
		},
		{
			name:      "reasoning summary delta",
			event:     "response.reasoning_summary_text.delta",
			data:      `{"type":"response.reasoning_summary_text.delta","delta":"think"}`,
			wantTypes: []core.ChunkType{core.ChunkThinking},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				if chunks[0].Delta != "think" {
					t.Errorf("delta = %q", chunks[0].Delta)
				}
			},
		},
		{
			name:      "reasoning text delta",
			event:     "response.reasoning_text.delta",
			data:      `{"type":"response.reasoning_text.delta","delta":"more"}`,
			wantTypes: []core.ChunkType{core.ChunkThinking},
		},
		{
			name:      "event name supplies missing type",
			event:     "response.output_text.delta",
			data:      `{"delta":"typed-by-name"}`,
			wantTypes: []core.ChunkType{core.ChunkText},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				if chunks[0].Delta != "typed-by-name" {
					t.Errorf("delta = %q", chunks[0].Delta)
				}
			},
		},
		{
			name:      "empty delta ignored",
			event:     "response.output_text.delta",
			data:      `{"type":"response.output_text.delta","delta":""}`,
			wantTypes: nil,
		},
		{
			name:      "completed carries usage then finish",
			event:     "response.completed",
			data:      `{"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":5,"input_tokens_details":{"cached_tokens":3},"output_tokens_details":{"reasoning_tokens":2}}}}`,
			wantTypes: []core.ChunkType{core.ChunkUsage, core.ChunkFinish},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				if chunks[0].Usage.TotalTokens != 15 || chunks[0].Usage.CachedTokens != 3 || chunks[0].Usage.ReasoningTokens != 2 {
					t.Errorf("usage = %+v", chunks[0].Usage)
				}
				if chunks[1].FinishReason != core.FinishStop {
					t.Errorf("finish = %q", chunks[1].FinishReason)
				}
			},
		},
		{
			name:      "incomplete max output tokens maps to length",
			event:     "response.incomplete",
			data:      `{"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"}}}`,
			wantTypes: []core.ChunkType{core.ChunkFinish},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				if chunks[0].FinishReason != core.FinishLength {
					t.Errorf("finish = %q", chunks[0].FinishReason)
				}
			},
		},
		{
			name:      "failed maps to error",
			event:     "response.failed",
			data:      `{"type":"response.failed","response":{"error":{"message":"boom"}}}`,
			wantTypes: []core.ChunkType{core.ChunkError},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				pe := core.AsProviderError(chunks[0].Err)
				if pe == nil || pe.Kind != core.ErrUpstream || pe.Message != "boom" {
					t.Errorf("err = %+v", pe)
				}
			},
		},
		{
			name:      "top-level error maps to error",
			event:     "error",
			data:      `{"type":"error","error":{"message":"rate limit exceeded"}}`,
			wantTypes: []core.ChunkType{core.ChunkError},
			check: func(t *testing.T, chunks []core.StreamChunk) {
				pe := core.AsProviderError(chunks[0].Err)
				if pe == nil || pe.Kind != core.ErrRateLimit {
					t.Errorf("err = %+v", pe)
				}
			},
		},
		{
			name:      "created ignored",
			event:     "response.created",
			data:      `{"type":"response.created","response":{"id":"resp_1"}}`,
			wantTypes: nil,
		},
		{
			name:      "done sentinel ignored",
			event:     "",
			data:      `[DONE]`,
			wantTypes: nil,
		},
		{
			name:      "unknown type ignored",
			event:     "response.something.else",
			data:      `{"type":"response.something.else"}`,
			wantTypes: nil,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			chunks, err := codec.ParseStreamEvent(tc.event, []byte(tc.data), &StreamState{})
			if err != nil {
				t.Fatalf("ParseStreamEvent error: %v", err)
			}
			if len(chunks) != len(tc.wantTypes) {
				t.Fatalf("chunks = %+v, want %v", chunks, tc.wantTypes)
			}
			for i, want := range tc.wantTypes {
				if chunks[i].Type != want {
					t.Errorf("chunk[%d].Type = %q, want %q", i, chunks[i].Type, want)
				}
			}
			if tc.check != nil && len(chunks) > 0 {
				tc.check(t, chunks)
			}
		})
	}

	if _, err := codec.ParseStreamEvent("", []byte(`{"type":`), &StreamState{}); err == nil {
		t.Error("malformed payload must error")
	}
}

func TestResponsesParseStreamEventToolCalls(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	state := &StreamState{}

	// Two parallel calls announced on distinct output indices must land on
	// distinct canonical indices, and argument fragments must follow.
	added1, err := codec.ParseStreamEvent("response.output_item.added",
		[]byte(`{"type":"response.output_item.added","output_index":0,"item":{"id":"fc_1","type":"function_call","call_id":"c1","name":"a"}}`), state)
	if err != nil {
		t.Fatalf("added1: %v", err)
	}
	added2, err := codec.ParseStreamEvent("response.output_item.added",
		[]byte(`{"type":"response.output_item.added","output_index":1,"item":{"id":"fc_2","type":"function_call","call_id":"c2","name":"b"}}`), state)
	if err != nil {
		t.Fatalf("added2: %v", err)
	}
	if len(added1) != 1 || len(added2) != 1 {
		t.Fatalf("added chunks = %v / %v", added1, added2)
	}
	if added1[0].Index == added2[0].Index {
		t.Errorf("parallel tool calls collided on index %d", added1[0].Index)
	}
	if added1[0].ToolCall.Name != "a" || added1[0].ToolCall.ID != "c1" {
		t.Errorf("call 1 = %+v", added1[0].ToolCall)
	}
	if added1[0].ToolCall.Arguments != nil {
		t.Errorf("opener must not carry arguments: %s", added1[0].ToolCall.Arguments)
	}

	// Fragments carry only arguments, and resolve to the same canonical index
	// whether addressed by output_index or item_id.
	byOutput, err := codec.ParseStreamEvent("response.function_call_arguments.delta",
		[]byte(`{"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\"a\":"}`), state)
	if err != nil {
		t.Fatalf("delta: %v", err)
	}
	byItem, err := codec.ParseStreamEvent("response.function_call_arguments.delta",
		[]byte(`{"type":"response.function_call_arguments.delta","item_id":"fc_2","output_index":9,"delta":"1}"}`), state)
	if err != nil {
		t.Fatalf("delta by item: %v", err)
	}
	if byOutput[0].Index != added2[0].Index || byItem[0].Index != added2[0].Index {
		t.Errorf("fragment indices = %d/%d, want %d", byOutput[0].Index, byItem[0].Index, added2[0].Index)
	}
	if string(byOutput[0].ToolCall.Arguments) != `{"a":` || string(byItem[0].ToolCall.Arguments) != "1}" {
		t.Errorf("fragments = %s / %s", byOutput[0].ToolCall.Arguments, byItem[0].ToolCall.Arguments)
	}

	// Codex custom tool calls deliver fragments in input_delta.
	custom, err := codec.ParseStreamEvent("response.custom_tool_call_input.delta",
		[]byte(`{"type":"response.custom_tool_call_input.delta","output_index":0,"input_delta":"ls"}`), state)
	if err != nil {
		t.Fatalf("custom delta: %v", err)
	}
	if len(custom) != 1 || string(custom[0].ToolCall.Arguments) != "ls" || custom[0].Index != added1[0].Index {
		t.Errorf("custom delta chunk = %+v", custom)
	}

	// An encrypted reasoning item arrives on output_item.done.
	done, err := codec.ParseStreamEvent("response.output_item.done",
		[]byte(`{"type":"response.output_item.done","item":{"id":"rs_1","type":"reasoning","encrypted_content":"enc_xyz"}}`), state)
	if err != nil {
		t.Fatalf("reasoning done: %v", err)
	}
	if len(done) != 1 || done[0].Type != core.ChunkThinking || done[0].Signature != "enc_xyz" {
		t.Errorf("reasoning done chunk = %+v", done)
	}

	// A plain message item done has nothing canonical to emit.
	none, err := codec.ParseStreamEvent("response.output_item.done",
		[]byte(`{"type":"response.output_item.done","item":{"id":"msg_1","type":"message"}}`), state)
	if err != nil {
		t.Fatalf("message done: %v", err)
	}
	if len(none) != 0 {
		t.Errorf("message done chunk = %+v", none)
	}
}

// ---- stream rendering -------------------------------------------------------

func TestResponsesRenderStreamEventSequence(t *testing.T) {
	state := &StreamState{Model: "gpt-5-codex", MessageID: "resp_fixed"}
	events := respRenderChunks(t, state,
		core.StreamChunk{Type: core.ChunkText, Delta: "Hel"},
		core.StreamChunk{Type: core.ChunkText, Delta: "lo"},
		core.StreamChunk{Type: core.ChunkThinking, Delta: "reason"},
		core.StreamChunk{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_1", Name: "f"}},
		core.StreamChunk{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"a":1}`)}},
		core.StreamChunk{Type: core.ChunkFinish, FinishReason: core.FinishToolCalls},
		core.StreamChunk{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 7, CompletionTokens: 3, TotalTokens: 10}},
	)
	names := respEventNames(events)

	// The sequence must open, stream each item, and terminate exactly once.
	if names[0] != "response.created" || names[1] != "response.in_progress" {
		t.Fatalf("stream must open with created/in_progress: %v", names)
	}
	if last := names[len(names)-1]; last != "response.completed" {
		t.Fatalf("stream must end with response.completed, got %v", names)
	}
	if got := strings.Count(strings.Join(names, ","), "response.completed"); got != 1 {
		t.Errorf("response.completed emitted %d times: %v", got, names)
	}

	// Item ordering: message item closes before the reasoning item opens, which
	// closes before the function_call item opens.
	msgAdded := respIndexOf(t, events, "response.output_item.added")
	if got := events[msgAdded].Payload["output_index"]; got != float64(0) {
		t.Errorf("message output_index = %v", got)
	}
	partAdded := respIndexOf(t, events, "response.content_part.added")
	delta := respIndexOf(t, events, "response.output_text.delta")
	textDone := respIndexOf(t, events, "response.output_text.done")
	if !(msgAdded < partAdded && partAdded < delta && delta < textDone) {
		t.Errorf("message event order: added=%d part=%d delta=%d done=%d", msgAdded, partAdded, delta, textDone)
	}
	reasoningAdded := respIndexOf(t, events, "response.reasoning_summary_part.added")
	if reasoningAdded < textDone {
		t.Errorf("reasoning opened before the message closed: %v", names)
	}
	toolAdded := respIndexOf(t, events, "response.function_call_arguments.delta")
	argsDone := respIndexOf(t, events, "response.function_call_arguments.done")
	if !(reasoningAdded < toolAdded && toolAdded < argsDone) {
		t.Errorf("tool event order: reasoning=%d delta=%d done=%d", reasoningAdded, toolAdded, argsDone)
	}
	if argsDone > len(names)-1-1 {
		t.Errorf("arguments.done must precede the terminal event: %v", names)
	}

	// Every item is closed by an output_item.done with a unique output_index.
	indices := map[float64]bool{}
	for _, ev := range events {
		if ev.Name != "response.output_item.added" {
			continue
		}
		idx, _ := ev.Payload["output_index"].(float64)
		if indices[idx] {
			t.Errorf("output_index %v reused", idx)
		}
		indices[idx] = true
	}
	if len(indices) != 3 {
		t.Errorf("output items = %d, want message+reasoning+function_call", len(indices))
	}

	// Sequence numbers are dense and monotonic across the whole stream.
	for i, ev := range events {
		if ev.Payload["sequence_number"] != float64(i+1) {
			t.Fatalf("event %d (%s) sequence_number = %v", i, ev.Name, ev.Payload["sequence_number"])
		}
	}

	// The terminal event must carry the accumulated output and the usage.
	completed := respFindEvent(t, events, "response.completed")
	response, _ := completed["response"].(map[string]any)
	if response == nil {
		t.Fatalf("completed payload = %v", completed)
	}
	if response["id"] != "resp_fixed" || response["object"] != "response" || response["status"] != "completed" {
		t.Errorf("completed response = %v", response)
	}
	if response["model"] != "gpt-5-codex" {
		t.Errorf("completed model = %v", response["model"])
	}
	output, _ := response["output"].([]any)
	if len(output) != 3 {
		t.Fatalf("completed output = %+v", response["output"])
	}
	message := output[0].(map[string]any)
	content := message["content"].([]any)[0].(map[string]any)
	if content["text"] != "Hello" {
		t.Errorf("accumulated text = %v", content["text"])
	}
	reasoning := output[1].(map[string]any)
	if reasoning["type"] != "reasoning" {
		t.Errorf("reasoning item = %v", reasoning)
	}
	call := output[2].(map[string]any)
	if call["type"] != "function_call" || call["arguments"] != `{"a":1}` || call["call_id"] != "call_1" {
		t.Errorf("accumulated function_call = %v", call)
	}
	usage, _ := response["usage"].(map[string]any)
	if usage == nil || usage["input_tokens"] != float64(7) || usage["output_tokens"] != float64(3) || usage["total_tokens"] != float64(10) {
		t.Errorf("completed usage = %v", response["usage"])
	}
}

func TestResponsesRenderStreamFinishBeforeUsage(t *testing.T) {
	// A finish chunk without usage must NOT close the response; the trailing
	// usage chunk carries the terminal event with the accumulated output.
	state := &StreamState{Model: "gpt-5", MessageID: "resp_x"}
	events := respRenderChunks(t, state,
		core.StreamChunk{Type: core.ChunkText, Delta: "hi"},
		core.StreamChunk{Type: core.ChunkFinish, FinishReason: core.FinishStop},
	)
	names := respEventNames(events)
	if names[len(names)-1] == "response.completed" {
		t.Fatalf("response must wait for the usage chunk: %v", names)
	}
	if names[len(names)-1] != "response.output_item.done" {
		t.Fatalf("finish must close the open item: %v", names)
	}

	more := respRenderChunks(t, state,
		core.StreamChunk{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 1, CompletionTokens: 2, TotalTokens: 3}},
	)
	if len(more) != 1 || more[0].Name != "response.completed" {
		t.Fatalf("usage must emit the terminal event: %v", respEventNames(more))
	}
	response := more[0].Payload["response"].(map[string]any)
	output, _ := response["output"].([]any)
	if len(output) != 1 {
		t.Fatalf("terminal output = %+v", response["output"])
	}
	content := output[0].(map[string]any)["content"].([]any)[0].(map[string]any)
	if content["text"] != "hi" {
		t.Errorf("terminal text = %v", content["text"])
	}
	if more[0].Payload["sequence_number"] != float64(len(events)+1) {
		t.Errorf("sequence continued incorrectly: %v", more[0].Payload["sequence_number"])
	}

	// A late usage chunk after completion must not emit a second terminal event.
	after := respRenderChunks(t, state,
		core.StreamChunk{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 9, CompletionTokens: 9, TotalTokens: 18}},
	)
	if len(after) != 0 {
		t.Errorf("post-completion usage emitted %v", respEventNames(after))
	}
}

func TestResponsesRenderStreamIncompleteOnLength(t *testing.T) {
	state := &StreamState{Model: "gpt-5", MessageID: "resp_len"}
	events := respRenderChunks(t, state,
		core.StreamChunk{Type: core.ChunkText, Delta: "cut"},
		core.StreamChunk{Type: core.ChunkFinish, FinishReason: core.FinishLength},
		core.StreamChunk{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 1, CompletionTokens: 1, TotalTokens: 2}},
	)
	terminal := events[len(events)-1]
	if terminal.Name != "response.incomplete" {
		t.Fatalf("terminal event = %s (%v)", terminal.Name, respEventNames(events))
	}
	response := terminal.Payload["response"].(map[string]any)
	if response["status"] != "incomplete" {
		t.Errorf("status = %v", response["status"])
	}
}

func TestResponsesRenderStreamDoneWithoutFinish(t *testing.T) {
	state := &StreamState{Model: "gpt-5", MessageID: "resp_done"}
	codec := OpenAIResponsesCodec{}
	raw, err := codec.RenderStreamChunk(core.StreamChunk{Type: core.ChunkText, Delta: "partial"}, state)
	if err != nil {
		t.Fatalf("RenderStreamChunk error: %v", err)
	}
	raw = append(raw, codec.RenderStreamDone(state)...)
	events := respParseEvents(t, raw)

	names := respEventNames(events)
	if names[len(names)-1] != "response.completed" {
		t.Fatalf("RenderStreamDone must terminate the stream: %v", names)
	}
	if got := strings.Count(strings.Join(names, ","), "response.completed"); got != 1 {
		t.Errorf("response.completed count = %d: %v", got, names)
	}
	response := events[len(events)-1].Payload["response"].(map[string]any)
	output, _ := response["output"].([]any)
	if len(output) != 1 {
		t.Fatalf("output = %+v", response["output"])
	}
	content := output[0].(map[string]any)["content"].([]any)[0].(map[string]any)
	if content["text"] != "partial" {
		t.Errorf("text = %v", content["text"])
	}

	// Nothing was ever started: no events at all.
	if got := codec.RenderStreamDone(&StreamState{}); len(got) != 0 {
		t.Errorf("empty stream must emit nothing, got %q", got)
	}
}

func TestResponsesRenderStreamToolCallWithoutArguments(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	state := &StreamState{Model: "gpt-5", MessageID: "resp_tool"}
	raw, err := codec.RenderStreamChunk(
		core.StreamChunk{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_9", Name: "f"}}, state)
	if err != nil {
		t.Fatalf("RenderStreamChunk error: %v", err)
	}
	// A call that never streamed argument bytes is closed at end of stream with
	// a valid empty JSON body.
	raw = append(raw, codec.RenderStreamDone(state)...)
	events := respParseEvents(t, raw)

	argsDone := respFindEvent(t, events, "response.function_call_arguments.done")
	if argsDone["arguments"] != "{}" {
		t.Errorf("empty arguments must serialize as {}: %v", argsDone["arguments"])
	}
	response := respFindEvent(t, events, "response.completed")["response"].(map[string]any)
	call := response["output"].([]any)[0].(map[string]any)
	if call["arguments"] != "{}" || call["call_id"] != "call_9" {
		t.Errorf("terminal function_call = %v", call)
	}
}

func TestResponsesRenderStreamParallelToolCalls(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	state := &StreamState{Model: "gpt-5", MessageID: "resp_par"}
	var raw [][]byte
	for _, chunk := range []core.StreamChunk{
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "c1", Name: "a"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"x":1}`)}},
		{Type: core.ChunkToolCall, Index: 1, ToolCall: &core.ToolCall{ID: "c2", Name: "b"}},
		{Type: core.ChunkToolCall, Index: 1, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"y":2}`)}},
	} {
		evs, err := codec.RenderStreamChunk(chunk, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%+v): %v", chunk, err)
		}
		raw = append(raw, evs...)
	}
	raw = append(raw, codec.RenderStreamDone(state)...)
	events := respParseEvents(t, raw)

	response := respFindEvent(t, events, "response.completed")["response"].(map[string]any)
	output, _ := response["output"].([]any)
	if len(output) != 2 {
		t.Fatalf("output = %+v", response["output"])
	}
	first := output[0].(map[string]any)
	second := output[1].(map[string]any)
	if first["call_id"] != "c1" || first["arguments"] != `{"x":1}` {
		t.Errorf("call 1 = %v", first)
	}
	if second["call_id"] != "c2" || second["arguments"] != `{"y":2}` {
		t.Errorf("call 2 = %v", second)
	}
	if first["id"] == second["id"] {
		t.Errorf("parallel calls share an item id: %v", first["id"])
	}
	if first["arguments"] != `{"x":1}` || second["arguments"] != `{"y":2}` {
		t.Errorf("argument fragments crossed calls: %v / %v", first["arguments"], second["arguments"])
	}
}

func TestResponsesRenderStreamErrorEvent(t *testing.T) {
	state := &StreamState{Model: "gpt-5", MessageID: "resp_err"}
	events := respRenderChunks(t, state, core.StreamChunk{
		Type: core.ChunkError,
		Err:  &core.ProviderError{Kind: core.ErrRateLimit, Message: "slow down"},
	})
	if len(events) != 1 || events[0].Name != "response.failed" {
		t.Fatalf("events = %v", respEventNames(events))
	}
	response := events[0].Payload["response"].(map[string]any)
	if response["status"] != "failed" {
		t.Errorf("status = %v", response["status"])
	}
	errObj, _ := response["error"].(map[string]any)
	if errObj["message"] != "slow down" || errObj["code"] != string(core.ErrRateLimit) {
		t.Errorf("error = %v", response["error"])
	}

	// A failed stream must not also emit a terminal completed event.
	done := OpenAIResponsesCodec{}.RenderStreamDone(state)
	if len(done) != 0 {
		t.Errorf("RenderStreamDone after failure = %q", done)
	}
}

func TestResponsesRenderStreamClosesItemsOnKindSwitch(t *testing.T) {
	// Text → tool call → text again: each switch must close the previous item
	// exactly once, and the terminal response must list all three items in
	// output-index order.
	codec := OpenAIResponsesCodec{}
	state := &StreamState{Model: "gpt-5", MessageID: "resp_switch"}
	var raw [][]byte
	for _, chunk := range []core.StreamChunk{
		{Type: core.ChunkText, Delta: "first"},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "c1", Name: "f"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"a":1}`)}},
		{Type: core.ChunkText, Delta: "second"},
	} {
		evs, err := codec.RenderStreamChunk(chunk, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%+v): %v", chunk, err)
		}
		raw = append(raw, evs...)
	}
	raw = append(raw, codec.RenderStreamDone(state)...)
	events := respParseEvents(t, raw)
	names := respEventNames(events)

	if got := strings.Count(strings.Join(names, ","), "response.output_item.done"); got != 3 {
		t.Fatalf("output_item.done count = %d: %v", got, names)
	}
	if got := strings.Count(strings.Join(names, ","), "response.function_call_arguments.done"); got != 1 {
		t.Errorf("arguments.done count = %d: %v", got, names)
	}
	// The tool call closes before the second message opens.
	argsDone := respIndexOf(t, events, "response.function_call_arguments.done")
	added := []int{}
	for i, ev := range events {
		if ev.Name == "response.output_item.added" {
			added = append(added, i)
		}
	}
	if len(added) != 3 {
		t.Fatalf("output_item.added count = %d: %v", len(added), names)
	}
	if !(added[0] < added[1] && added[1] < argsDone && argsDone < added[2]) {
		t.Errorf("switch order wrong: added=%v argsDone=%d", added, argsDone)
	}

	response := respFindEvent(t, events, "response.completed")["response"].(map[string]any)
	output, _ := response["output"].([]any)
	if len(output) != 3 {
		t.Fatalf("output = %+v", response["output"])
	}
	first := output[0].(map[string]any)
	if first["type"] != "message" || first["content"].([]any)[0].(map[string]any)["text"] != "first" {
		t.Errorf("first item = %v", first)
	}
	call := output[1].(map[string]any)
	if call["type"] != "function_call" || call["arguments"] != `{"a":1}` {
		t.Errorf("middle item = %v", call)
	}
	second := output[2].(map[string]any)
	if second["type"] != "message" || second["content"].([]any)[0].(map[string]any)["text"] != "second" {
		t.Errorf("last item = %v", second)
	}
}

func TestResponsesRenderStreamIgnoresPing(t *testing.T) {
	state := &StreamState{Model: "gpt-5"}
	events := respRenderChunks(t, state, core.StreamChunk{Type: core.ChunkPing})
	if len(events) != 0 {
		t.Errorf("ping must not render: %v", respEventNames(events))
	}
}

// TestResponsesRenderStreamReadableBySSEParser proves the rendered bytes are
// framed so the gateway's own SSE reader recovers every event, name and payload
// included.
func TestResponsesRenderStreamReadableBySSEParser(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	state := &StreamState{Model: "gpt-5", MessageID: "resp_sse"}
	var raw [][]byte
	for _, chunk := range []core.StreamChunk{
		{Type: core.ChunkThinking, Delta: "think"},
		{Type: core.ChunkText, Delta: "hi"},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "c1", Name: "f"}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: json.RawMessage(`{"a":1}`)}},
	} {
		evs, err := codec.RenderStreamChunk(chunk, state)
		if err != nil {
			t.Fatalf("RenderStreamChunk(%+v): %v", chunk, err)
		}
		raw = append(raw, evs...)
	}
	raw = append(raw, codec.RenderStreamDone(state)...)

	var body []byte
	for _, ev := range raw {
		body = append(body, ev...)
	}
	var got []respEvent
	if err := ReadSSE(strings.NewReader(string(body)), func(name string, data []byte) error {
		var payload map[string]any
		if err := json.Unmarshal(data, &payload); err != nil {
			t.Errorf("event %q payload is not JSON: %v", name, err)
			return nil
		}
		got = append(got, respEvent{Name: name, Payload: payload})
		return nil
	}); err != nil {
		t.Fatalf("ReadSSE error: %v", err)
	}
	if len(got) != len(raw) {
		t.Fatalf("ReadSSE recovered %d events, rendered %d", len(got), len(raw))
	}
	for i, ev := range got {
		if ev.Name == "" {
			t.Fatalf("event %d lost its name", i)
		}
		if ev.Payload["type"] != ev.Name {
			t.Errorf("event %d payload type = %v, name %q", i, ev.Payload["type"], ev.Name)
		}
		if ev.Payload["sequence_number"] != float64(i+1) {
			t.Errorf("event %d sequence_number = %v", i, ev.Payload["sequence_number"])
		}
	}
	if got[len(got)-1].Name != "response.completed" {
		t.Errorf("last event = %q", got[len(got)-1].Name)
	}
}

// TestResponsesStreamRoundTrip feeds the parse side's chunks into the render
// side and asserts the client sees the same text, thinking, and tool call.
func TestResponsesStreamRoundTrip(t *testing.T) {
	codec := OpenAIResponsesCodec{}
	upstream := [][]byte{
		[]byte(`{"type":"response.created","response":{"id":"resp_up"}}`),
		[]byte(`{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_1","type":"message"}}`),
		[]byte(`{"type":"response.output_text.delta","delta":"the "}`),
		[]byte(`{"type":"response.output_text.delta","delta":"answer"}`),
		[]byte(`{"type":"response.output_item.added","output_index":1,"item":{"id":"fc_1","type":"function_call","call_id":"call_7","name":"f"}}`),
		[]byte(`{"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\"a\":"}`),
		[]byte(`{"type":"response.function_call_arguments.delta","output_index":1,"delta":"1}"}`),
		[]byte(`{"type":"response.completed","response":{"usage":{"input_tokens":4,"output_tokens":6}}}`),
	}

	upState := &StreamState{Model: "gpt-5"}
	downState := &StreamState{Model: "gpt-5", MessageID: "resp_down"}
	var rendered [][]byte
	for _, data := range upstream {
		chunks, err := codec.ParseStreamEvent("", data, upState)
		if err != nil {
			t.Fatalf("ParseStreamEvent(%s): %v", data, err)
		}
		for _, chunk := range chunks {
			evs, err := codec.RenderStreamChunk(chunk, downState)
			if err != nil {
				t.Fatalf("RenderStreamChunk(%+v): %v", chunk, err)
			}
			rendered = append(rendered, evs...)
		}
	}
	events := respParseEvents(t, rendered)
	response := respFindEvent(t, events, "response.completed")["response"].(map[string]any)
	output, _ := response["output"].([]any)
	if len(output) != 2 {
		t.Fatalf("output = %+v", response["output"])
	}
	message := output[0].(map[string]any)
	if got := message["content"].([]any)[0].(map[string]any)["text"]; got != "the answer" {
		t.Errorf("round-tripped text = %v", got)
	}
	call := output[1].(map[string]any)
	if call["call_id"] != "call_7" || call["name"] != "f" || call["arguments"] != `{"a":1}` {
		t.Errorf("round-tripped call = %v", call)
	}
	usage, _ := response["usage"].(map[string]any)
	if usage["input_tokens"] != float64(4) || usage["output_tokens"] != float64(6) {
		t.Errorf("round-tripped usage = %v", response["usage"])
	}
}
