package transform

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"tera-router/server/internal/core"
)

// OpenAIResponsesCodec handles OpenAI's Responses API wire format (/v1/responses),
// the dialect spoken by Codex and Responses-native clients. Unlike Chat
// Completions, turns live under "input" as typed items (message / function_call
// / function_call_output / reasoning), the system prompt travels as
// "instructions", tools are flat ({type,name,description,parameters}), and
// streaming is a typed event sequence (response.created → output_item.added →
// output_text.delta → ... → response.completed) rather than uniform deltas.
type OpenAIResponsesCodec struct{}

func (OpenAIResponsesCodec) Dialect() core.Dialect { return core.DialectOpenAIResponses }

// respMaxCallIDLen is the longest call_id the Responses API accepts; longer ids
// are rejected with HTTP 400. Both the call and its output are clamped the same
// way so the pair still matches upstream.
const respMaxCallIDLen = 64

// respMaxInstructionsLen is the Responses API's 1 MiB cap on instructions.
const respMaxInstructionsLen = 1 << 20

func respClampCallID(id string) string {
	if len(id) > respMaxCallIDLen {
		return id[:respMaxCallIDLen]
	}
	return id
}

func respClampInstructions(s string) string {
	if len(s) <= respMaxInstructionsLen {
		return s
	}
	return s[:respMaxInstructionsLen-100] + "\n\n[TRUNCATED: system prompt exceeded 1MB limit]"
}

// responsesAPIAllowlist enumerates the fields the Responses API accepts on an
// outbound request. Anything else is stripped so Chat Completions parameters
// (max_tokens, temperature, top_p, stream_options, ...) and router-internal
// keys can never reach an upstream as an "Unsupported parameter" 400.
var responsesAPIAllowlist = map[string]bool{
	"model":                true,
	"input":                true,
	"instructions":         true,
	"tools":                true,
	"tool_choice":          true,
	"stream":               true,
	"store":                true,
	"reasoning":            true,
	"text":                 true,
	"max_output_tokens":    true,
	"service_tier":         true,
	"include":              true,
	"prompt_cache_key":     true,
	"parallel_tool_calls":  true,
	"previous_response_id": true,
	"metadata":             true,
	"truncation":           true,
	"user":                 true,
}

// respPassthroughFields are the Responses fields the canonical model does not
// model explicitly; they ride along in ChatRequest.Extra so a same-dialect
// upstream still receives them.
var respPassthroughFields = []string{
	"store", "include", "service_tier", "prompt_cache_key", "parallel_tool_calls",
	"previous_response_id", "metadata", "truncation", "user",
}

// ---- wire types -------------------------------------------------------------

type respRequest struct {
	Model        string          `json:"model"`
	Input        json.RawMessage `json:"input"`
	Instructions string          `json:"instructions"`
	Tools        []respTool      `json:"tools"`
	ToolChoice   json.RawMessage `json:"tool_choice"`
	Reasoning    json.RawMessage `json:"reasoning"`
	Text         json.RawMessage `json:"text"`
	// Chat Completions parameters accepted on inbound parse for graceful
	// passthrough through the canonical model, but never rendered outbound —
	// the Responses API rejects them.
	MaxOutputTokens *int     `json:"max_output_tokens"`
	Temperature     *float64 `json:"temperature"`
	TopP            *float64 `json:"top_p"`
	Stream          bool     `json:"stream"`
}

type respTool struct {
	Type        string          `json:"type"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
	// Function is the nested Chat Completions shape some clients send.
	Function *struct {
		Name        string          `json:"name"`
		Description string          `json:"description"`
		Parameters  json.RawMessage `json:"parameters"`
	} `json:"function"`
}

type respInputItem struct {
	Type             string            `json:"type"`
	Role             string            `json:"role"`
	Content          json.RawMessage   `json:"content"`
	CallID           string            `json:"call_id"`
	Name             string            `json:"name"`
	Arguments        string            `json:"arguments"`
	Output           json.RawMessage   `json:"output"`
	Summary          []respSummaryPart `json:"summary"`
	EncryptedContent string            `json:"encrypted_content"`
}

type respSummaryPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type respContentPart struct {
	Type     string          `json:"type"`
	Text     string          `json:"text"`
	ImageURL json.RawMessage `json:"image_url"`
}

// ---- request parsing (inbound Responses client) -----------------------------

func (OpenAIResponsesCodec) ParseRequest(body []byte) (*core.ChatRequest, error) {
	var raw respRequest
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("openai-responses: parse request: %w", err)
	}

	req := &core.ChatRequest{
		Model:          raw.Model,
		System:         raw.Instructions,
		Stream:         raw.Stream,
		Temperature:    raw.Temperature,
		TopP:           raw.TopP,
		MaxTokens:      raw.MaxOutputTokens,
		Reasoning:      respParseReasoning(raw.Reasoning),
		ToolChoice:     respParseToolChoice(raw.ToolChoice),
		ResponseFormat: respParseTextFormat(raw.Text),
		Extra:          respParseExtra(body),
	}

	for _, t := range raw.Tools {
		if t.Type != "" && t.Type != "function" {
			// Hosted tools (web_search, file_search, image_generation, ...) are
			// not functions; they ride along in Extra for same-dialect routing.
			continue
		}
		name, desc, params := t.Name, t.Description, t.Parameters
		if t.Function != nil {
			if t.Function.Name != "" {
				name = t.Function.Name
			}
			if t.Function.Description != "" {
				desc = t.Function.Description
			}
			if len(bytes.TrimSpace(t.Function.Parameters)) > 0 {
				params = t.Function.Parameters
			}
		}
		if strings.TrimSpace(name) == "" {
			continue
		}
		req.Tools = append(req.Tools, core.Tool{Name: name, Description: desc, Parameters: params})
	}

	if err := respParseInput(raw.Input, req); err != nil {
		return nil, err
	}
	return req, nil
}

// respParseInput decodes the `input` field — a plain prompt string or an array
// of typed items — into canonical messages. System/developer messages are
// hoisted into req.System, consecutive function_call items merge into one
// assistant message, and consecutive function_call_output items merge into one
// tool message (one result part each).
func respParseInput(raw json.RawMessage, req *core.ChatRequest) error {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil
	}
	if trimmed[0] == '"' {
		var s string
		if json.Unmarshal(trimmed, &s) == nil && s != "" {
			req.Messages = append(req.Messages, core.Message{
				Role:    core.RoleUser,
				Content: []core.ContentPart{{Type: core.PartText, Text: s}},
			})
		}
		return nil
	}

	var items []respInputItem
	if err := json.Unmarshal(trimmed, &items); err != nil {
		return fmt.Errorf("openai-responses: parse input: %w", err)
	}

	// pending holds a reasoning item until the assistant turn it belongs to
	// arrives; Codex requires reasoning items to precede that turn.
	var pending *core.ContentPart
	for _, item := range items {
		itemType := item.Type
		if itemType == "" && item.Role != "" {
			itemType = "message" // some clients omit type on role items
		}

		switch itemType {
		case "message":
			role := respMapRole(item.Role)
			parts := respParseContent(item.Content)
			if role == core.RoleSystem {
				if text := respTextOf(parts); text != "" {
					if req.System != "" {
						req.System += "\n\n"
					}
					req.System += text
				}
				continue
			}
			msg := core.Message{Role: role}
			if pending != nil {
				if role == core.RoleAssistant {
					msg.Content = append(msg.Content, *pending)
				}
				pending = nil
			}
			msg.Content = append(msg.Content, parts...)
			req.Messages = append(req.Messages, msg)

		case "function_call":
			name := strings.TrimSpace(item.Name)
			if name == "" {
				continue
			}
			args := json.RawMessage(item.Arguments)
			if len(bytes.TrimSpace(args)) == 0 {
				args = json.RawMessage("{}")
			}
			part := core.ContentPart{
				Type:     core.PartToolCall,
				ToolCall: &core.ToolCall{ID: item.CallID, Name: name, Arguments: args},
			}
			if n := len(req.Messages); n > 0 && pending == nil {
				last := &req.Messages[n-1]
				if last.Role == core.RoleAssistant && respNoTextParts(last.Content) {
					last.Content = append(last.Content, part)
					continue
				}
			}
			msg := core.Message{Role: core.RoleAssistant}
			if pending != nil {
				msg.Content = append(msg.Content, *pending)
				pending = nil
			}
			msg.Content = append(msg.Content, part)
			req.Messages = append(req.Messages, msg)

		case "function_call_output":
			result := core.ContentPart{
				Type:       core.PartToolResult,
				ToolResult: &core.ToolResult{CallID: item.CallID, Content: respRawToString(item.Output)},
			}
			if n := len(req.Messages); n > 0 {
				last := &req.Messages[n-1]
				if last.Role == core.RoleTool && respOnlyToolResults(last.Content) {
					last.Content = append(last.Content, result)
					continue
				}
			}
			req.Messages = append(req.Messages, core.Message{
				Role:    core.RoleTool,
				Content: []core.ContentPart{result},
			})

		case "reasoning":
			text, encrypted := respExtractReasoning(item)
			if text == "" && encrypted == "" {
				continue
			}
			if pending == nil {
				pending = &core.ContentPart{Type: core.PartThinking}
			}
			if text != "" {
				if pending.Text != "" {
					pending.Text += "\n"
				}
				pending.Text += text
			}
			if encrypted != "" {
				pending.Signature = encrypted
			}
		}
	}
	return nil
}

// respParseContent decodes a message's content field, which may be a plain
// string or an array of typed parts.
func respParseContent(raw json.RawMessage) []core.ContentPart {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	if trimmed[0] == '"' {
		var s string
		if json.Unmarshal(trimmed, &s) == nil && s != "" {
			return []core.ContentPart{{Type: core.PartText, Text: s}}
		}
		return nil
	}
	var parts []respContentPart
	if err := json.Unmarshal(trimmed, &parts); err != nil {
		return nil
	}
	var out []core.ContentPart
	for _, p := range parts {
		switch p.Type {
		case "input_text", "output_text", "text":
			if p.Text != "" {
				out = append(out, core.ContentPart{Type: core.PartText, Text: p.Text})
			}
		case "input_image":
			if url := respImageURL(p.ImageURL); url != "" {
				out = append(out, core.ContentPart{Type: core.PartImage, Media: respParseImageURL(url)})
			}
		}
	}
	return out
}

// respImageURL reads an input_image's url, which is a string or an object with
// a url field.
func respImageURL(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return ""
	}
	if trimmed[0] == '"' {
		var s string
		_ = json.Unmarshal(trimmed, &s)
		return s
	}
	var obj struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(trimmed, &obj)
	return obj.URL
}

// respParseImageURL decomposes an image URL into a MediaPayload: data URIs are
// split into MIMEType + base64 data, everything else stays a remote URL.
func respParseImageURL(rawURL string) *core.MediaPayload {
	if rest, ok := strings.CutPrefix(rawURL, "data:"); ok {
		if i := strings.Index(rest, ";base64,"); i > 0 {
			return &core.MediaPayload{MIMEType: rest[:i], Data: rest[i+len(";base64,"):]}
		}
	}
	return &core.MediaPayload{URL: rawURL}
}

// respMediaURL renders a MediaPayload as a URL: inline base64 becomes a data
// URI, a remote URL is returned as-is.
func respMediaURL(m *core.MediaPayload) string {
	if m.Data != "" {
		mime := m.MIMEType
		if mime == "" {
			mime = "image/png"
		}
		return "data:" + mime + ";base64," + m.Data
	}
	return m.URL
}

// respExtractReasoning returns the summary text and encrypted_content of a
// reasoning item. encrypted_content must be echoed back on follow-up turns when
// the client asked for include: ["reasoning.encrypted_content"].
func respExtractReasoning(item respInputItem) (text string, encrypted string) {
	var parts []string
	for _, s := range item.Summary {
		if s.Text != "" {
			parts = append(parts, s.Text)
		}
	}
	return strings.Join(parts, "\n"), item.EncryptedContent
}

func respMapRole(role string) core.Role {
	switch role {
	case "assistant":
		return core.RoleAssistant
	case "system", "developer":
		return core.RoleSystem
	case "tool":
		return core.RoleTool
	default:
		return core.RoleUser
	}
}

func respRawToString(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return ""
	}
	if trimmed[0] == '"' {
		var s string
		if json.Unmarshal(trimmed, &s) == nil {
			return s
		}
	}
	return string(trimmed)
}

func respTextOf(parts []core.ContentPart) string {
	var b strings.Builder
	for _, p := range parts {
		if p.Type != core.PartText || p.Text == "" {
			continue
		}
		if b.Len() > 0 {
			b.WriteString("\n")
		}
		b.WriteString(p.Text)
	}
	return b.String()
}

// respNoTextParts reports whether an assistant message carries no text, i.e. it
// holds only tool calls (possibly none). Consecutive function_call items merge
// into such a message so one assistant turn becomes one canonical message, while
// a preceding message that carried real text stays its own turn.
func respNoTextParts(parts []core.ContentPart) bool {
	for _, p := range parts {
		if p.Type == core.PartText && p.Text != "" {
			return false
		}
	}
	return true
}

func respOnlyToolResults(parts []core.ContentPart) bool {
	if len(parts) == 0 {
		return false
	}
	for _, p := range parts {
		if p.Type != core.PartToolResult {
			return false
		}
	}
	return true
}

// respParseReasoning folds the Responses reasoning object into the canonical
// config. The Responses API only models effort (plus a summary preference).
func respParseReasoning(raw json.RawMessage) *core.ReasoningConfig {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	var obj struct {
		Effort string `json:"effort"`
	}
	if json.Unmarshal(trimmed, &obj) != nil || obj.Effort == "" {
		return nil
	}
	return &core.ReasoningConfig{Effort: obj.Effort}
}

// respParseToolChoice decodes tool_choice: a mode string, the flat Responses
// form {"type":"function","name":...}, or the nested Chat Completions form.
func respParseToolChoice(raw json.RawMessage) *core.ToolChoice {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	var s string
	if json.Unmarshal(trimmed, &s) == nil {
		if s == "" {
			return nil
		}
		return &core.ToolChoice{Mode: s}
	}
	var obj struct {
		Type     string `json:"type"`
		Name     string `json:"name"`
		Function struct {
			Name string `json:"name"`
		} `json:"function"`
	}
	if json.Unmarshal(trimmed, &obj) != nil {
		return nil
	}
	name := obj.Name
	if name == "" {
		name = obj.Function.Name
	}
	if obj.Type == "function" {
		if name == "" {
			return nil
		}
		return &core.ToolChoice{Mode: "function", Name: name}
	}
	if obj.Type != "" {
		return &core.ToolChoice{Mode: obj.Type}
	}
	return nil
}

// respParseTextFormat extracts the structured-output format from the Responses
// `text` object. Only json_schema is modelled canonically; other formats
// (json_object, text) pass through verbatim via Extra.
func respParseTextFormat(raw json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	var obj struct {
		Format json.RawMessage `json:"format"`
	}
	if json.Unmarshal(trimmed, &obj) != nil {
		return nil
	}
	format := bytes.TrimSpace(obj.Format)
	if len(format) == 0 {
		return nil
	}
	var probe struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(format, &probe) != nil || probe.Type != "json_schema" {
		return nil
	}
	return json.RawMessage(format)
}

// respRenderResponseFormat converts the canonical ResponseFormat into a
// Responses text.format object, accepting both the Responses shape
// ({"type":"json_schema","name":...}) and the Chat Completions shape
// ({"type":"json_schema","json_schema":{"name":...,"schema":...}}).
func respRenderResponseFormat(raw json.RawMessage) any {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	var probe struct {
		Type   string          `json:"type"`
		Name   string          `json:"name"`
		Schema json.RawMessage `json:"schema"`
		Strict *bool           `json:"strict"`
		// Chat Completions nests the schema definition.
		JSONSchema *struct {
			Name   string          `json:"name"`
			Schema json.RawMessage `json:"schema"`
			Strict *bool           `json:"strict"`
		} `json:"json_schema"`
	}
	if json.Unmarshal(trimmed, &probe) != nil {
		return nil
	}
	if probe.JSONSchema != nil {
		out := map[string]any{
			"type":   "json_schema",
			"name":   probe.JSONSchema.Name,
			"schema": probe.JSONSchema.Schema,
		}
		if probe.JSONSchema.Strict != nil {
			out["strict"] = *probe.JSONSchema.Strict
		}
		return out
	}
	if probe.Type != "json_schema" {
		return nil
	}
	out := map[string]any{"type": "json_schema", "name": probe.Name, "schema": probe.Schema}
	if probe.Strict != nil {
		out["strict"] = *probe.Strict
	}
	return out
}

// respMergeTextObject rebuilds the Responses `text` object, preserving any
// passthrough keys (verbosity, ...) a same-dialect client sent while forcing the
// canonical structured-output format.
func respMergeTextObject(raw json.RawMessage, format any) map[string]any {
	out := map[string]any{}
	if len(bytes.TrimSpace(raw)) > 0 {
		var passthrough map[string]any
		if json.Unmarshal(raw, &passthrough) == nil {
			for k, v := range passthrough {
				if k != "format" {
					out[k] = v
				}
			}
		}
	}
	out["format"] = format
	return out
}

// respParseExtra preserves the allowlisted Responses fields the canonical model
// does not model, plus the hosted tool definitions and any non-json_schema
// `text` object, so a same-dialect upstream still receives them.
func respParseExtra(body []byte) map[string]json.RawMessage {
	var all map[string]json.RawMessage
	if json.Unmarshal(body, &all) != nil {
		return nil
	}
	extra := map[string]json.RawMessage{}
	for _, k := range respPassthroughFields {
		if v, ok := all[k]; ok && len(bytes.TrimSpace(v)) > 0 {
			extra[k] = v
		}
	}
	if raw, ok := all["text"]; ok && len(bytes.TrimSpace(raw)) > 0 && json.Valid(raw) {
		// Kept verbatim for same-dialect passthrough (verbosity, format, ...);
		// RenderRequest merges it with the canonical ResponseFormat.
		extra["text"] = raw
	}
	if builtin := respBuiltinTools(all); len(builtin) > 0 {
		extra["tools_builtin"] = builtin
	}
	if len(extra) == 0 {
		return nil
	}
	return extra
}

// respBuiltinTools returns the raw definitions of the non-function tools
// (web_search, file_search, ...) in the request body.
func respBuiltinTools(all map[string]json.RawMessage) json.RawMessage {
	rawTools := bytes.TrimSpace(all["tools"])
	if len(rawTools) == 0 || rawTools[0] != '[' {
		return nil
	}
	var tools []json.RawMessage
	if json.Unmarshal(rawTools, &tools) != nil {
		return nil
	}
	var builtin []json.RawMessage
	for _, raw := range tools {
		var probe struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(raw, &probe) != nil {
			continue
		}
		if probe.Type != "" && probe.Type != "function" {
			builtin = append(builtin, raw)
		}
	}
	if len(builtin) == 0 {
		return nil
	}
	out, err := json.Marshal(builtin)
	if err != nil {
		return nil
	}
	return out
}

// ---- request rendering (outbound to a Responses provider) -------------------

func (OpenAIResponsesCodec) RenderRequest(req *core.ChatRequest, providerID string) ([]byte, error) {
	out := map[string]any{
		"model":        req.Model,
		"instructions": respClampInstructions(req.System),
		"stream":       req.Stream,
		// Conversations are never persisted server-side.
		"store": false,
	}

	input := make([]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		input = append(input, respRenderMessage(m)...)
	}
	out["input"] = input

	if len(req.Tools) > 0 || len(req.Extra["tools_builtin"]) > 0 {
		tools := make([]any, 0, len(req.Tools)+1)
		for _, t := range req.Tools {
			params := t.Parameters
			if len(bytes.TrimSpace(params)) == 0 {
				params = json.RawMessage(`{"type":"object","properties":{}}`)
			}
			tools = append(tools, map[string]any{
				"type":        "function",
				"name":        t.Name,
				"description": t.Description,
				"parameters":  params,
			})
		}
		// Hosted tools parsed from a Responses client pass through verbatim; no
		// other dialect writes this key.
		var builtin []json.RawMessage
		if json.Unmarshal(req.Extra["tools_builtin"], &builtin) == nil {
			for _, b := range builtin {
				tools = append(tools, b)
			}
		}
		out["tools"] = tools
	}

	if tc := req.ToolChoice; tc != nil && tc.Mode != "" {
		if tc.Mode == "function" {
			out["tool_choice"] = map[string]any{"type": "function", "name": tc.Name}
		} else {
			out["tool_choice"] = tc.Mode
		}
	}

	if r := req.Reasoning; r != nil && r.Effort != "" {
		out["reasoning"] = map[string]any{"effort": r.Effort}
	}

	// Codex rejects max_output_tokens outright. Chat Completions' max_tokens /
	// max_completion_tokens / temperature / top_p never belong on this wire.
	if providerID != "codex" {
		if v := respMaxOutputTokens(req); v != nil {
			out["max_output_tokens"] = *v
		}
	}

	if f := respRenderResponseFormat(req.ResponseFormat); f != nil {
		out["text"] = respMergeTextObject(req.Extra["text"], f)
	}

	for k, v := range req.Extra {
		if !responsesAPIAllowlist[k] {
			continue
		}
		if _, set := out[k]; set {
			continue
		}
		out[k] = v
	}

	body, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("openai-responses: render request: %w", err)
	}
	return body, nil
}

// respMaxOutputTokens picks the canonical max-output knob: the Responses
// max_output_tokens maps to MaxTokens, the newer-OpenAI max_completion_tokens is
// the fallback for Chat clients routed to a Responses provider.
func respMaxOutputTokens(req *core.ChatRequest) *int {
	if req.MaxTokens != nil {
		return req.MaxTokens
	}
	return req.MaxCompletionTokens
}

// respRenderMessage converts one canonical message into input items: a leading
// reasoning item for the assistant turn, a message item with typed content
// parts, one function_call item per tool call, and one function_call_output item
// per tool result.
func respRenderMessage(m core.Message) []any {
	if m.Role == core.RoleTool {
		var out []any
		for _, p := range m.Content {
			if p.Type != core.PartToolResult || p.ToolResult == nil {
				continue
			}
			out = append(out, map[string]any{
				"type":    "function_call_output",
				"call_id": respClampCallID(p.ToolResult.CallID),
				"output":  p.ToolResult.Content,
			})
		}
		return out
	}

	var out []any
	// Reasoning precedes the assistant turn it belongs to; at most one item per
	// turn, as Codex expects.
	for _, p := range m.Content {
		if p.Type == core.PartThinking && (p.Text != "" || p.Signature != "") {
			out = append(out, respRenderReasoningItem("", p.Text, p.Signature))
			break
		}
	}

	role := string(m.Role)
	if role == "" {
		role = string(core.RoleUser)
	}
	contentType := "input_text"
	if m.Role == core.RoleAssistant {
		contentType = "output_text"
	}
	var content []any
	for _, p := range m.Content {
		switch p.Type {
		case core.PartText:
			content = append(content, map[string]any{"type": contentType, "text": p.Text})
		case core.PartImage:
			if p.Media == nil {
				continue
			}
			content = append(content, map[string]any{
				"type":      "input_image",
				"image_url": respMediaURL(p.Media),
				"detail":    "auto",
			})
		}
	}
	if len(content) > 0 {
		out = append(out, map[string]any{"type": "message", "role": role, "content": content})
	}

	for _, p := range m.Content {
		if p.Type != core.PartToolCall || p.ToolCall == nil {
			continue
		}
		args := p.ToolCall.Arguments
		if len(bytes.TrimSpace(args)) == 0 {
			args = json.RawMessage("{}")
		}
		name := p.ToolCall.Name
		if name == "" {
			name = "_unknown"
		}
		out = append(out, map[string]any{
			"type":      "function_call",
			"call_id":   respClampCallID(p.ToolCall.ID),
			"name":      name,
			"arguments": string(args),
		})
	}
	return out
}

// respRenderReasoningItem builds a reasoning item. The id is omitted for input
// items (only output items carry one) and for reasoning without any payload.
func respRenderReasoningItem(id, text, signature string) map[string]any {
	item := map[string]any{"type": "reasoning"}
	if id != "" {
		item["id"] = id
	}
	if text != "" {
		item["summary"] = []any{map[string]any{"type": "summary_text", "text": text}}
	}
	if signature != "" {
		item["encrypted_content"] = signature
	}
	return item
}

// ---- unary response parsing (from a Responses provider) ---------------------

type respUnary struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Output []struct {
		Type             string            `json:"type"`
		Role             string            `json:"role"`
		Content          []respContentPart `json:"content"`
		CallID           string            `json:"call_id"`
		Name             string            `json:"name"`
		Arguments        string            `json:"arguments"`
		Summary          []respSummaryPart `json:"summary"`
		EncryptedContent string            `json:"encrypted_content"`
	} `json:"output"`
	IncompleteDetails *struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Usage *respUsage `json:"usage"`
}

type respUsage struct {
	InputTokens        int `json:"input_tokens"`
	OutputTokens       int `json:"output_tokens"`
	TotalTokens        int `json:"total_tokens"`
	InputTokensDetails struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"input_tokens_details"`
	OutputTokensDetails struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"output_tokens_details"`
}

func (OpenAIResponsesCodec) ParseResponse(body []byte, model string) (*core.ChatResponse, error) {
	var raw respUnary
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("openai-responses: parse response: %w", err)
	}

	msg := core.Message{Role: core.RoleAssistant}
	finish := core.FinishStop
	hasToolCalls := false
	for _, item := range raw.Output {
		switch item.Type {
		case "reasoning":
			var parts []string
			for _, s := range item.Summary {
				if s.Text != "" {
					parts = append(parts, s.Text)
				}
			}
			text := strings.Join(parts, "\n")
			if text != "" || item.EncryptedContent != "" {
				msg.Content = append(msg.Content, core.ContentPart{
					Type:      core.PartThinking,
					Text:      text,
					Signature: item.EncryptedContent,
				})
			}
		case "message":
			for _, p := range item.Content {
				if (p.Type == "output_text" || p.Type == "text") && p.Text != "" {
					msg.Content = append(msg.Content, core.ContentPart{Type: core.PartText, Text: p.Text})
				}
			}
		case "function_call", "custom_tool_call":
			args := json.RawMessage(item.Arguments)
			if len(bytes.TrimSpace(args)) == 0 {
				args = json.RawMessage("{}")
			}
			msg.Content = append(msg.Content, core.ContentPart{
				Type:     core.PartToolCall,
				ToolCall: &core.ToolCall{ID: item.CallID, Name: item.Name, Arguments: args},
			})
			hasToolCalls = true
		}
	}

	switch {
	case hasToolCalls:
		finish = core.FinishToolCalls
	case raw.Status == "incomplete" && raw.IncompleteDetails != nil && raw.IncompleteDetails.Reason == "max_output_tokens":
		finish = core.FinishLength
	case raw.Status == "failed":
		finish = core.FinishError
	}

	resp := &core.ChatResponse{ID: raw.ID, Model: model, Message: msg, FinishReason: finish}
	if u := respParseUsage(raw.Usage); u != nil {
		resp.Usage = *u
	}
	return resp, nil
}

func respParseUsage(u *respUsage) *core.Usage {
	if u == nil {
		return nil
	}
	total := u.TotalTokens
	if total == 0 {
		total = u.InputTokens + u.OutputTokens
	}
	return &core.Usage{
		PromptTokens:     u.InputTokens,
		CompletionTokens: u.OutputTokens,
		TotalTokens:      total,
		CachedTokens:     u.InputTokensDetails.CachedTokens,
		ReasoningTokens:  u.OutputTokensDetails.ReasoningTokens,
	}
}

// respRenderUsage renders the canonical usage as the Responses usage object,
// including the cached/reasoning detail blocks.
func respRenderUsage(u *core.Usage) map[string]any {
	if u == nil {
		u = &core.Usage{}
	}
	return map[string]any{
		"input_tokens":  u.PromptTokens,
		"output_tokens": u.CompletionTokens,
		"total_tokens":  u.TotalTokens,
		"input_tokens_details": map[string]any{
			"cached_tokens": u.CachedTokens,
		},
		"output_tokens_details": map[string]any{
			"reasoning_tokens": u.ReasoningTokens,
		},
	}
}

// RenderResponse encodes a canonical response as a Responses API result for a
// client that speaks the Responses dialect.
func (OpenAIResponsesCodec) RenderResponse(resp *core.ChatResponse) ([]byte, error) {
	id := resp.ID
	if id == "" {
		id = respRandomID("resp_")
	}
	status := "completed"
	if resp.FinishReason == core.FinishLength {
		status = "incomplete"
	}

	output := make([]any, 0, len(resp.Message.Content))
	for i, p := range resp.Message.Content {
		switch p.Type {
		case core.PartThinking:
			output = append(output, respRenderReasoningItem(
				fmt.Sprintf("rs_%s_%d", id, i), p.Text, p.Signature))
		case core.PartText:
			output = append(output, respMessageItem(fmt.Sprintf("msg_%s_%d", id, i), p.Text))
		case core.PartToolCall:
			if p.ToolCall == nil {
				continue
			}
			args := p.ToolCall.Arguments
			if len(bytes.TrimSpace(args)) == 0 {
				args = json.RawMessage("{}")
			}
			output = append(output, map[string]any{
				"id":        "fc_" + p.ToolCall.ID,
				"type":      "function_call",
				"call_id":   p.ToolCall.ID,
				"name":      p.ToolCall.Name,
				"arguments": string(args),
				"status":    "completed",
			})
		}
	}

	out := map[string]any{
		"id":         id,
		"object":     "response",
		"created_at": time.Now().Unix(),
		"status":     status,
		"model":      resp.Model,
		"output":     output,
		"usage":      respRenderUsage(&resp.Usage),
	}
	body, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("openai-responses: render response: %w", err)
	}
	return body, nil
}

// respMessageItem builds an assistant message output item carrying one
// output_text part.
func respMessageItem(id, text string) map[string]any {
	return map[string]any{
		"id":      id,
		"type":    "message",
		"role":    "assistant",
		"status":  "completed",
		"content": []any{respOutputTextPart(text)},
	}
}

func respOutputTextPart(text string) map[string]any {
	return map[string]any{"type": "output_text", "text": text, "annotations": []any{}}
}

// ---- stream parsing (upstream Responses provider) ---------------------------

// respStreamEvent is one Responses SSE data payload.
type respStreamEvent struct {
	Type        string          `json:"type"`
	Delta       string          `json:"delta"`
	InputDelta  string          `json:"input_delta"`
	OutputIndex int             `json:"output_index"`
	ItemID      string          `json:"item_id"`
	Item        *respStreamItem `json:"item"`
	Response    *struct {
		Usage             *respUsage `json:"usage"`
		IncompleteDetails *struct {
			Reason string `json:"reason"`
		} `json:"incomplete_details"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	} `json:"response"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type respStreamItem struct {
	Type             string `json:"type"`
	ID               string `json:"id"`
	CallID           string `json:"call_id"`
	Name             string `json:"name"`
	EncryptedContent string `json:"encrypted_content"`
}

// respToolIndexes maps upstream output items to compact canonical tool-call
// indices: each response.output_item.added / function_call_arguments.delta
// carries its own output_index (and item_id), and without the mapping every
// parallel tool call would surface as index 0 and collide downstream.
type respToolIndexes struct {
	byOutput map[int]int
	byItem   map[string]int
	next     int
}

const respKeyToolIndex = "openai_responses.tool_index"

func respToolIndexFor(state *StreamState, outputIndex int, itemID string) int {
	if state == nil {
		return outputIndex
	}
	if state.Custom == nil {
		state.Custom = map[string]any{}
	}
	idx, _ := state.Custom[respKeyToolIndex].(*respToolIndexes)
	if idx == nil {
		idx = &respToolIndexes{byOutput: map[int]int{}, byItem: map[string]int{}}
		state.Custom[respKeyToolIndex] = idx
	}
	if itemID != "" {
		if i, ok := idx.byItem[itemID]; ok {
			idx.byOutput[outputIndex] = i
			return i
		}
	}
	if i, ok := idx.byOutput[outputIndex]; ok {
		if itemID != "" {
			idx.byItem[itemID] = i
		}
		return i
	}
	i := idx.next
	idx.next++
	idx.byOutput[outputIndex] = i
	if itemID != "" {
		idx.byItem[itemID] = i
	}
	return i
}

// ParseStreamEvent decodes one upstream Responses SSE event into canonical
// chunks. The event name may be empty, in which case the payload's own type
// field is authoritative.
func (OpenAIResponsesCodec) ParseStreamEvent(event string, data []byte, state *StreamState) ([]core.StreamChunk, error) {
	payload := bytes.TrimSpace(data)
	if len(payload) == 0 || bytes.Equal(payload, []byte("[DONE]")) {
		return nil, nil
	}

	var ev respStreamEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return nil, fmt.Errorf("openai-responses: parse stream event: %w", err)
	}
	evType := ev.Type
	if evType == "" {
		evType = event
	}

	switch evType {
	case "response.output_text.delta":
		if ev.Delta == "" {
			return nil, nil
		}
		return []core.StreamChunk{{Type: core.ChunkText, Delta: ev.Delta}}, nil

	case "response.reasoning_summary_text.delta", "response.reasoning_text.delta":
		if ev.Delta == "" {
			return nil, nil
		}
		return []core.StreamChunk{{Type: core.ChunkThinking, Delta: ev.Delta}}, nil

	case "response.output_item.added":
		if ev.Item != nil && (ev.Item.Type == "function_call" || ev.Item.Type == "custom_tool_call") {
			return []core.StreamChunk{{
				Type:  core.ChunkToolCall,
				Index: respToolIndexFor(state, ev.OutputIndex, ev.Item.ID),
				ToolCall: &core.ToolCall{
					ID:   ev.Item.CallID,
					Name: ev.Item.Name,
				},
			}}, nil
		}
		return nil, nil

	case "response.function_call_arguments.delta", "response.custom_tool_call_input.delta":
		// Codex's native tools stream through custom_tool_call_input.delta,
		// which carries the fragment in input_delta rather than delta.
		fragment := ev.Delta
		if fragment == "" {
			fragment = ev.InputDelta
		}
		if fragment == "" {
			return nil, nil
		}
		return []core.StreamChunk{{
			Type:     core.ChunkToolCall,
			Index:    respToolIndexFor(state, ev.OutputIndex, ev.ItemID),
			ToolCall: &core.ToolCall{Arguments: json.RawMessage(fragment)},
		}}, nil

	case "response.output_item.done":
		if ev.Item != nil && ev.Item.Type == "reasoning" && ev.Item.EncryptedContent != "" {
			return []core.StreamChunk{{
				Type:      core.ChunkThinking,
				Signature: ev.Item.EncryptedContent,
			}}, nil
		}
		return nil, nil

	case "response.completed", "response.incomplete":
		var chunks []core.StreamChunk
		if ev.Response != nil {
			if u := respParseUsage(ev.Response.Usage); u != nil {
				chunks = append(chunks, core.StreamChunk{Type: core.ChunkUsage, Usage: u})
			}
		}
		reason := core.FinishStop
		if evType == "response.incomplete" {
			reason = core.FinishLength
			if ev.Response != nil && ev.Response.IncompleteDetails != nil && ev.Response.IncompleteDetails.Reason != "max_output_tokens" {
				reason = core.FinishStop
			}
		}
		chunks = append(chunks, core.StreamChunk{Type: core.ChunkFinish, FinishReason: reason})
		return chunks, nil

	case "response.failed", "error":
		msg := "upstream stream error"
		if ev.Error != nil && ev.Error.Message != "" {
			msg = ev.Error.Message
		} else if ev.Response != nil && ev.Response.Error != nil && ev.Response.Error.Message != "" {
			msg = ev.Response.Error.Message
		}
		kind := core.ErrUpstream
		if respLooksRateLimited(msg) {
			kind = core.ErrRateLimit
		}
		return []core.StreamChunk{{
			Type: core.ChunkError,
			Err:  &core.ProviderError{Kind: kind, Message: msg},
		}}, nil

	default:
		// response.created, in_progress, output_text.done, content_part.*,
		// reasoning_summary_*_done: nothing canonical to emit.
		return nil, nil
	}
}

// respLooksRateLimited recognizes the quota/overload wording upstreams use when
// they abort a stream, so the dispatcher cools the account down instead of
// treating it as a transient fault.
func respLooksRateLimited(msg string) bool {
	m := strings.ToLower(msg)
	return strings.Contains(m, "rate limit") ||
		strings.Contains(m, "overloaded") ||
		strings.Contains(m, "quota") ||
		strings.Contains(m, "too many requests") ||
		strings.Contains(m, "capacity")
}

// ---- stream rendering (client speaks Responses) -----------------------------

const respKeyRenderState = "openai_responses.render"

// respRenderTool accumulates one streamed function call.
type respRenderTool struct {
	outIdx int
	itemID string
	callID string
	name   string
	args   string
	added  bool
	closed bool
	item   map[string]any
}

// respRenderState tracks the Responses event sequence for one stream: sequence
// numbers, the currently open item, and everything accumulated for the terminal
// response object.
type respRenderState struct {
	state      *StreamState
	seq        int
	started    bool
	completed  bool
	responseID string
	createdAt  int64

	finishSeen   bool
	finishReason core.FinishReason
	usage        *core.Usage

	// items maps every finished output item by its output_index so the terminal
	// response lists them in the order the client saw them, regardless of the
	// order in which they were closed.
	items   map[int]any
	nextIdx int

	openKind string // "", "message", "reasoning"

	msgIdx       int
	msgID        string
	msgText      string
	msgPartAdded bool

	rsIdx       int
	rsID        string
	rsText      string
	rsSignature string
	rsPartAdded bool

	tools map[int]*respRenderTool
}

func respRenderStateFor(state *StreamState) *respRenderState {
	if state == nil {
		state = &StreamState{}
	}
	if state.Custom == nil {
		state.Custom = map[string]any{}
	}
	if s, ok := state.Custom[respKeyRenderState].(*respRenderState); ok {
		return s
	}
	s := &respRenderState{
		state:     state,
		createdAt: time.Now().Unix(),
		items:     map[int]any{},
		tools:     map[int]*respRenderTool{},
	}
	s.responseID = state.MessageID
	if s.responseID == "" {
		s.responseID = respRandomID("resp_")
	}
	state.Custom[respKeyRenderState] = s
	return s
}

func (s *respRenderState) model() string {
	if s.state == nil {
		return ""
	}
	return s.state.Model
}

func (s *respRenderState) assignIdx() int {
	i := s.nextIdx
	s.nextIdx++
	return i
}

func (s *respRenderState) tool(index int) *respRenderTool {
	if t, ok := s.tools[index]; ok {
		return t
	}
	t := &respRenderTool{}
	s.tools[index] = t
	return t
}

// outputItems returns the finished items ordered by output_index.
func (s *respRenderState) outputItems() []any {
	idx := make([]int, 0, len(s.items))
	for i := range s.items {
		idx = append(idx, i)
	}
	sort.Ints(idx)
	out := make([]any, 0, len(idx))
	for _, i := range idx {
		out = append(out, s.items[i])
	}
	return out
}

// start emits the opening response.created / response.in_progress pair once.
func (s *respRenderState) start(emit func(string, map[string]any)) {
	if s.started {
		return
	}
	s.started = true
	emit("response.created", map[string]any{
		"response": map[string]any{
			"id":         s.responseID,
			"object":     "response",
			"created_at": s.createdAt,
			"status":     "in_progress",
			"model":      s.model(),
			"output":     []any{},
		},
	})
	emit("response.in_progress", map[string]any{
		"response": map[string]any{
			"id":         s.responseID,
			"object":     "response",
			"created_at": s.createdAt,
			"status":     "in_progress",
			"model":      s.model(),
		},
	})
}

// openMessage starts a fresh message output item, closing whatever was open.
func (s *respRenderState) openMessage(emit func(string, map[string]any)) {
	s.closeOpen(emit)
	s.openKind = "message"
	s.msgIdx = s.assignIdx()
	s.msgID = fmt.Sprintf("msg_%s_%d", s.responseID, s.msgIdx)
	s.msgText = ""
	s.msgPartAdded = false
	emit("response.output_item.added", map[string]any{
		"output_index": s.msgIdx,
		"item": map[string]any{
			"id": s.msgID, "type": "message", "role": "assistant",
			"status": "in_progress", "content": []any{},
		},
	})
}

// openReasoning starts a fresh reasoning output item.
func (s *respRenderState) openReasoning(emit func(string, map[string]any)) {
	s.closeOpen(emit)
	s.openKind = "reasoning"
	s.rsIdx = s.assignIdx()
	s.rsID = fmt.Sprintf("rs_%s_%d", s.responseID, s.rsIdx)
	s.rsText = ""
	s.rsSignature = ""
	s.rsPartAdded = false
	emit("response.output_item.added", map[string]any{
		"output_index": s.rsIdx,
		"item": map[string]any{
			"id": s.rsID, "type": "reasoning", "status": "in_progress", "summary": []any{},
		},
	})
}

// closeTools finishes every function_call item still open, in output-index
// order, recording each for the terminal response object.
func (s *respRenderState) closeTools(emit func(string, map[string]any)) {
	idx := make([]int, 0, len(s.tools))
	for i, t := range s.tools {
		if t.added && !t.closed {
			idx = append(idx, i)
		}
	}
	sort.Ints(idx)
	for _, i := range idx {
		t := s.tools[i]
		if t.args == "" {
			// A call that streamed no argument bytes still needs a valid JSON
			// body for the client to parse.
			t.args = "{}"
		}
		t.closed = true
		t.item["arguments"] = t.args
		t.item["status"] = "completed"
		emit("response.function_call_arguments.done", map[string]any{
			"item_id": t.itemID, "output_index": t.outIdx, "arguments": t.args,
		})
		emit("response.output_item.done", map[string]any{"output_index": t.outIdx, "item": t.item})
		s.items[t.outIdx] = t.item
	}
}

// closeOpen finishes the currently open output item(s) and records them for the
// terminal response object. Switching item kinds calls this so no item is left
// half-open; it is idempotent.
func (s *respRenderState) closeOpen(emit func(string, map[string]any)) {
	switch s.openKind {
	case "message":
		item := respMessageItem(s.msgID, s.msgText)
		emit("response.output_text.done", map[string]any{
			"item_id": s.msgID, "output_index": s.msgIdx, "content_index": 0, "text": s.msgText,
		})
		emit("response.content_part.done", map[string]any{
			"item_id": s.msgID, "output_index": s.msgIdx, "content_index": 0,
			"part": respOutputTextPart(s.msgText),
		})
		emit("response.output_item.done", map[string]any{"output_index": s.msgIdx, "item": item})
		s.items[s.msgIdx] = item

	case "reasoning":
		if s.rsPartAdded {
			emit("response.reasoning_summary_text.done", map[string]any{
				"item_id": s.rsID, "output_index": s.rsIdx, "summary_index": 0, "text": s.rsText,
			})
			emit("response.reasoning_summary_part.done", map[string]any{
				"item_id": s.rsID, "output_index": s.rsIdx, "summary_index": 0,
				"part": map[string]any{"type": "summary_text", "text": s.rsText},
			})
		}
		item := respRenderReasoningItem(s.rsID, s.rsText, s.rsSignature)
		emit("response.output_item.done", map[string]any{"output_index": s.rsIdx, "item": item})
		s.items[s.rsIdx] = item
	}
	s.openKind = ""
	s.closeTools(emit)
}

// emitCompleted emits the terminal response.completed (or response.incomplete)
// event carrying every accumulated output item and the usage seen so far.
func (s *respRenderState) emitCompleted(emit func(string, map[string]any)) {
	if s.completed {
		return
	}
	s.completed = true

	name := "response.completed"
	status := "completed"
	if s.finishReason == core.FinishLength {
		name = "response.incomplete"
		status = "incomplete"
	}
	response := map[string]any{
		"id":         s.responseID,
		"object":     "response",
		"created_at": s.createdAt,
		"status":     status,
		"model":      s.model(),
		"output":     s.outputItems(),
	}
	if s.usage != nil {
		response["usage"] = respRenderUsage(s.usage)
	}
	emit(name, map[string]any{"response": response})
}

// respMergeUsage merges a usage update into the accumulated one: non-zero
// fields overwrite, and the total is recomputed when the upstream omitted it.
func respMergeUsage(cur, next *core.Usage) *core.Usage {
	if next == nil {
		return cur
	}
	if cur == nil {
		merged := *next
		return &merged
	}
	if next.PromptTokens > 0 {
		cur.PromptTokens = next.PromptTokens
	}
	if next.CompletionTokens > 0 {
		cur.CompletionTokens = next.CompletionTokens
	}
	if next.CachedTokens > 0 {
		cur.CachedTokens = next.CachedTokens
	}
	if next.ReasoningTokens > 0 {
		cur.ReasoningTokens = next.ReasoningTokens
	}
	if next.TotalTokens > 0 {
		cur.TotalTokens = next.TotalTokens
	} else {
		cur.TotalTokens = cur.PromptTokens + cur.CompletionTokens
	}
	return cur
}

// RenderStreamChunk emits the Responses event sequence for a canonical chunk.
// Switching output item kinds closes the previous item, and the terminal
// response.completed waits for the usage/end of stream so it always carries the
// full accumulated output.
func (OpenAIResponsesCodec) RenderStreamChunk(chunk core.StreamChunk, state *StreamState) ([][]byte, error) {
	s := respRenderStateFor(state)
	var events [][]byte
	emit := func(eventType string, data map[string]any) {
		s.seq++
		data["type"] = eventType
		data["sequence_number"] = s.seq
		b, err := json.Marshal(data)
		if err != nil {
			b = []byte(`{}`)
		}
		events = append(events, SSEEvent(eventType, b))
	}

	switch chunk.Type {
	case core.ChunkText:
		if chunk.Delta == "" {
			return nil, nil
		}
		s.start(emit)
		if s.openKind != "message" {
			s.openMessage(emit)
		}
		if !s.msgPartAdded {
			s.msgPartAdded = true
			emit("response.content_part.added", map[string]any{
				"item_id": s.msgID, "output_index": s.msgIdx, "content_index": 0,
				"part": respOutputTextPart(""),
			})
		}
		s.msgText += chunk.Delta
		emit("response.output_text.delta", map[string]any{
			"item_id": s.msgID, "output_index": s.msgIdx, "content_index": 0,
			"delta": chunk.Delta,
		})

	case core.ChunkThinking:
		if chunk.Delta == "" && chunk.Signature == "" {
			return nil, nil
		}
		s.start(emit)
		if s.openKind != "reasoning" {
			s.openReasoning(emit)
		}
		if chunk.Delta != "" {
			if !s.rsPartAdded {
				s.rsPartAdded = true
				emit("response.reasoning_summary_part.added", map[string]any{
					"item_id": s.rsID, "output_index": s.rsIdx, "summary_index": 0,
					"part": map[string]any{"type": "summary_text", "text": ""},
				})
			}
			s.rsText += chunk.Delta
			emit("response.reasoning_summary_text.delta", map[string]any{
				"item_id": s.rsID, "output_index": s.rsIdx, "summary_index": 0,
				"delta": chunk.Delta,
			})
		}
		if chunk.Signature != "" {
			s.rsSignature = chunk.Signature
		}

	case core.ChunkToolCall:
		if chunk.ToolCall == nil {
			return nil, nil
		}
		s.start(emit)
		t := s.tool(chunk.Index)
		if t.callID == "" && chunk.ToolCall.ID != "" {
			t.callID = chunk.ToolCall.ID
		}
		if chunk.ToolCall.Name != "" {
			t.name = chunk.ToolCall.Name
		}
		if !t.added {
			// Opening a new call closes whatever item was open before it, so
			// the client never sees two items streaming at once.
			s.closeOpen(emit)
			t.added = true
			t.outIdx = s.assignIdx()
			if t.callID == "" {
				t.callID = respRandomID("call_")
			}
			t.itemID = "fc_" + t.callID
			t.item = map[string]any{
				"id": t.itemID, "type": "function_call", "call_id": t.callID,
				"name": t.name, "arguments": "", "status": "in_progress",
			}
			emit("response.output_item.added", map[string]any{
				"output_index": t.outIdx,
				"item":         t.item,
			})
		}
		if args := string(chunk.ToolCall.Arguments); args != "" && !t.closed {
			t.args += args
			emit("response.function_call_arguments.delta", map[string]any{
				"item_id": t.itemID, "output_index": t.outIdx, "delta": args,
			})
		}

	case core.ChunkFinish:
		s.start(emit)
		s.finishSeen = true
		s.finishReason = chunk.FinishReason
		s.closeOpen(emit)
		if s.usage != nil {
			s.emitCompleted(emit)
		}

	case core.ChunkUsage:
		if chunk.Usage == nil {
			return nil, nil
		}
		s.start(emit)
		s.usage = respMergeUsage(s.usage, chunk.Usage)
		if s.finishSeen {
			s.closeOpen(emit)
			s.emitCompleted(emit)
		}

	case core.ChunkError:
		s.completed = true
		msg := "upstream stream error"
		kind := core.ErrUpstream
		if pe := core.AsProviderError(chunk.Err); pe != nil {
			if pe.Message != "" {
				msg = pe.Message
			}
			if pe.Kind != "" {
				kind = pe.Kind
			}
		}
		emit("response.failed", map[string]any{
			"response": map[string]any{
				"id":         s.responseID,
				"object":     "response",
				"created_at": s.createdAt,
				"status":     "failed",
				"error":      map[string]any{"code": string(kind), "message": msg},
			},
		})

	default:
		// ChunkPing and unknown chunk types have no Responses representation.
		return nil, nil
	}
	return events, nil
}

// RenderStreamDone closes whatever item is still open and emits the terminal
// response.completed when no usage/finish chunk already did.
func (OpenAIResponsesCodec) RenderStreamDone(state *StreamState) [][]byte {
	s := respRenderStateFor(state)
	if s.completed || !s.started {
		return nil
	}
	var events [][]byte
	emit := func(eventType string, data map[string]any) {
		s.seq++
		data["type"] = eventType
		data["sequence_number"] = s.seq
		b, err := json.Marshal(data)
		if err != nil {
			b = []byte(`{}`)
		}
		events = append(events, SSEEvent(eventType, b))
	}
	s.closeOpen(emit)
	s.emitCompleted(emit)
	return events
}

// respRandomID mints an id with the given prefix (resp_, call_, ...).
func respRandomID(prefix string) string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + "000000000000000000000000"
	}
	return prefix + hex.EncodeToString(b[:])
}
