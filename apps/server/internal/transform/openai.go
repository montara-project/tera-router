package transform

import (
	"bytes"
	"cmp"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"tera-router/server/internal/core"
)

// OpenAICodec handles the OpenAI Chat Completions wire format, the de-facto
// standard most CLI tools speak.
type OpenAICodec struct{}

func (OpenAICodec) Dialect() core.Dialect { return core.DialectOpenAI }

// ---- wire types -------------------------------------------------------------

type oaiRequest struct {
	Model               string          `json:"model"`
	Messages            []oaiMessage    `json:"messages"`
	Tools               []oaiTool       `json:"tools,omitempty"`
	ToolChoice          json.RawMessage `json:"tool_choice,omitempty"`
	Temperature         *float64        `json:"temperature,omitempty"`
	TopP                *float64        `json:"top_p,omitempty"`
	MaxTokens           *int            `json:"max_tokens,omitempty"`
	MaxCompletionTokens *int            `json:"max_completion_tokens,omitempty"`
	Stop                json.RawMessage `json:"stop,omitempty"`
	Stream              bool            `json:"stream,omitempty"`
	ResponseFormat      json.RawMessage `json:"response_format,omitempty"`
	// ReasoningEffort is the OpenAI-style effort knob ("low"/"medium"/"high").
	// Reasoning is the object form some clients send ({"effort":...} or
	// {"max_tokens":...}); both fold into the canonical ReasoningConfig.
	ReasoningEffort string          `json:"reasoning_effort,omitempty"`
	Reasoning       json.RawMessage `json:"reasoning,omitempty"`
}

type oaiMessage struct {
	Role       string          `json:"role"`
	Content    json.RawMessage `json:"content"`
	Name       string          `json:"name,omitempty"`
	ToolCalls  []oaiToolCall   `json:"tool_calls,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	// ReasoningContent carries thinking/reasoning text that must be echoed
	// back on follow-up turns for DeepSeek, MiniMax, and similar providers.
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

type oaiToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type,omitempty"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type oaiTool struct {
	Type     string `json:"type"`
	Function struct {
		Name        string          `json:"name"`
		Description string          `json:"description,omitempty"`
		Parameters  json.RawMessage `json:"parameters,omitempty"`
	} `json:"function"`
}

// oaiKnownRequestFields lists the body keys the canonical model handles
// explicitly; everything else is preserved verbatim in ChatRequest.Extra so a
// same-dialect upstream still receives it.
var oaiKnownRequestFields = []string{
	"model", "messages", "tools", "tool_choice",
	"temperature", "top_p", "max_tokens", "max_completion_tokens",
	"stop", "stream", "response_format", "reasoning_effort", "reasoning",
}

// ---- request parsing --------------------------------------------------------

func (OpenAICodec) ParseRequest(body []byte) (*core.ChatRequest, error) {
	var raw oaiRequest
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("openai: parse request: %w", err)
	}
	if raw.Model == "" {
		return nil, fmt.Errorf("openai: parse request: missing model")
	}
	if len(raw.Messages) == 0 {
		return nil, fmt.Errorf("openai: parse request: missing messages")
	}

	// A JSON null (which json.RawMessage preserves as the literal "null") must
	// not be re-emitted, so it is normalized to an absent field.
	responseFormat := raw.ResponseFormat
	if string(bytes.TrimSpace(responseFormat)) == "null" {
		responseFormat = nil
	}

	req := &core.ChatRequest{
		Model:               raw.Model,
		Temperature:         raw.Temperature,
		TopP:                raw.TopP,
		MaxTokens:           raw.MaxTokens,
		MaxCompletionTokens: raw.MaxCompletionTokens,
		Stop:                parseOAIStop(raw.Stop),
		Stream:              raw.Stream,
		ToolChoice:          parseOAIToolChoice(raw.ToolChoice),
		ResponseFormat:      responseFormat,
		Reasoning:           parseOAIReasoning(raw.ReasoningEffort, raw.Reasoning),
		Extra:               parseOAIExtra(body),
	}

	for _, t := range raw.Tools {
		if t.Type != "" && t.Type != "function" {
			continue
		}
		req.Tools = append(req.Tools, core.Tool{
			Name:        t.Function.Name,
			Description: t.Function.Description,
			Parameters:  t.Function.Parameters,
		})
	}

	for _, m := range raw.Messages {
		msg, isSystem, sysText := parseOAIMessage(m)
		if isSystem {
			// Hoist system/developer content to the top-level field.
			if req.System != "" {
				req.System += "\n\n"
			}
			req.System += sysText
			continue
		}
		req.Messages = append(req.Messages, msg)
	}
	return req, nil
}

// parseOAIExtra preserves request fields the canonical model does not model
// explicitly (stream_options, user, seed, n, penalties, metadata, ...).
func parseOAIExtra(body []byte) map[string]json.RawMessage {
	var all map[string]json.RawMessage
	if err := json.Unmarshal(body, &all); err != nil {
		return nil
	}
	for _, k := range oaiKnownRequestFields {
		delete(all, k)
	}
	if len(all) == 0 {
		return nil
	}
	return all
}

// parseOAIReasoning folds the ways a client can express reasoning intent into
// the canonical ReasoningConfig: a top-level reasoning_effort string and/or a
// reasoning object ({"effort": ...} or {"max_tokens": N}). Returns nil when no
// reasoning intent is present.
func parseOAIReasoning(effort string, reasoning json.RawMessage) *core.ReasoningConfig {
	rc := &core.ReasoningConfig{}
	if len(reasoning) > 0 {
		var obj struct {
			Effort    string `json:"effort"`
			MaxTokens int    `json:"max_tokens"`
		}
		if json.Unmarshal(reasoning, &obj) == nil {
			rc.Effort = obj.Effort
			if obj.MaxTokens > 0 {
				rc.MaxTokens = obj.MaxTokens
			}
		}
	}
	if rc.Effort == "" {
		rc.Effort = effort
	}
	if rc.Effort == "" && rc.MaxTokens == 0 {
		return nil
	}
	return rc
}

// parseOAIStop decodes a stop field that may be a single string or an array of
// strings.
func parseOAIStop(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if s == "" {
			return nil
		}
		return []string{s}
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return arr
	}
	return nil
}

// parseOAIToolChoice decodes tool_choice, which is either a mode string
// ("auto"/"none"/"required") or {"type":"function","function":{"name":...}}.
func parseOAIToolChoice(raw json.RawMessage) *core.ToolChoice {
	if len(raw) == 0 {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if s == "" {
			return nil
		}
		return &core.ToolChoice{Mode: s}
	}
	var obj struct {
		Type     string `json:"type"`
		Function struct {
			Name string `json:"name"`
		} `json:"function"`
	}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil
	}
	if obj.Type == "function" && obj.Function.Name != "" {
		return &core.ToolChoice{Mode: "function", Name: obj.Function.Name}
	}
	if obj.Type != "" {
		return &core.ToolChoice{Mode: obj.Type}
	}
	return nil
}

// parseOAIMessage converts one OpenAI message to canonical form. System and
// developer roles are reported separately so the caller can hoist them.
func parseOAIMessage(m oaiMessage) (msg core.Message, isSystem bool, sysText string) {
	role := m.Role
	// OpenAI's "developer" role is a system-equivalent for newer models.
	if role == "system" || role == "developer" {
		return core.Message{}, true, decodeOAIContentText(m.Content)
	}

	msg.Role = mapOAIRole(role)
	msg.Name = m.Name

	// Preserve reasoning_content as a thinking part.
	if m.ReasoningContent != "" && role == "assistant" {
		msg.Content = append(msg.Content, core.ContentPart{
			Type: core.PartThinking,
			Text: m.ReasoningContent,
		})
	}

	for _, tc := range m.ToolCalls {
		msg.Content = append(msg.Content, core.ContentPart{
			Type: core.PartToolCall,
			ToolCall: &core.ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			},
		})
	}

	// Tool result message.
	if role == "tool" {
		msg.Content = append(msg.Content, core.ContentPart{
			Type: core.PartToolResult,
			ToolResult: &core.ToolResult{
				CallID:  m.ToolCallID,
				Content: decodeOAIContentText(m.Content),
			},
		})
		return msg, false, ""
	}

	// Text / multimodal content parts.
	msg.Content = append(msg.Content, decodeOAIContentParts(m.Content)...)
	return msg, false, ""
}

func mapOAIRole(role string) core.Role {
	switch role {
	case "user":
		return core.RoleUser
	case "assistant":
		return core.RoleAssistant
	case "tool":
		return core.RoleTool
	default:
		return core.RoleUser
	}
}

// decodeOAIContentText extracts plain text from an OpenAI content field, which
// may be a string or an array of typed parts.
func decodeOAIContentText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var b strings.Builder
	for _, p := range decodeOAIContentParts(raw) {
		if p.Type == core.PartText {
			b.WriteString(p.Text)
		}
	}
	return b.String()
}

// decodeOAIContentParts extracts canonical content parts from an OpenAI content
// field (string or array of {type,text|image_url}).
func decodeOAIContentParts(raw json.RawMessage) []core.ContentPart {
	if len(raw) == 0 {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if s == "" {
			return nil
		}
		return []core.ContentPart{{Type: core.PartText, Text: s}}
	}

	var arr []struct {
		Type     string `json:"type"`
		Text     string `json:"text"`
		ImageURL struct {
			URL string `json:"url"`
		} `json:"image_url"`
	}
	if err := json.Unmarshal(raw, &arr); err != nil {
		return nil
	}

	var parts []core.ContentPart
	for _, p := range arr {
		switch p.Type {
		case "text":
			parts = append(parts, core.ContentPart{Type: core.PartText, Text: p.Text})
		case "image_url":
			parts = append(parts, core.ContentPart{
				Type:  core.PartImage,
				Media: parseImageURL(p.ImageURL.URL),
			})
		}
	}
	return parts
}

// ---- request rendering ------------------------------------------------------

func (OpenAICodec) RenderRequest(req *core.ChatRequest, _ string) ([]byte, error) {
	out := map[string]any{"model": req.Model}

	var msgs []oaiMessage
	if req.System != "" {
		content, err := json.Marshal(req.System)
		if err != nil {
			return nil, fmt.Errorf("openai: render system: %w", err)
		}
		msgs = append(msgs, oaiMessage{Role: string(core.RoleSystem), Content: content})
	}
	for _, m := range req.Messages {
		msgs = append(msgs, renderOAIMessage(m)...)
	}
	out["messages"] = msgs

	if len(req.Tools) > 0 {
		tools := make([]map[string]any, 0, len(req.Tools))
		for _, t := range req.Tools {
			fn := map[string]any{"name": t.Name}
			if t.Description != "" {
				fn["description"] = t.Description
			}
			if len(t.Parameters) > 0 {
				fn["parameters"] = t.Parameters
			}
			tools = append(tools, map[string]any{"type": "function", "function": fn})
		}
		out["tools"] = tools
	}

	if tc := req.ToolChoice; tc != nil && tc.Mode != "" {
		if tc.Mode == "function" {
			out["tool_choice"] = map[string]any{
				"type":     "function",
				"function": map[string]string{"name": tc.Name},
			}
		} else {
			out["tool_choice"] = tc.Mode
		}
	}

	if len(req.Stop) > 0 {
		out["stop"] = req.Stop
	}
	if req.Temperature != nil {
		out["temperature"] = *req.Temperature
	}
	if req.TopP != nil {
		out["top_p"] = *req.TopP
	}

	// Newer OpenAI model families reject the legacy max_tokens key; otherwise
	// the legacy key wins unless it is the only one absent.
	if core.IsOpenAINewerMaxTokensFamily(req.Model) || (req.MaxTokens == nil && req.MaxCompletionTokens != nil) {
		v := req.MaxCompletionTokens
		if v == nil {
			v = req.MaxTokens
		}
		if v != nil {
			out["max_completion_tokens"] = *v
		}
	} else if req.MaxTokens != nil {
		out["max_tokens"] = *req.MaxTokens
	}

	if r := req.Reasoning; r != nil {
		if r.Effort != "" {
			out["reasoning_effort"] = r.Effort
		}
		if r.MaxTokens > 0 {
			reasoning := map[string]any{"max_tokens": r.MaxTokens}
			if r.Effort != "" {
				reasoning["effort"] = r.Effort
			}
			out["reasoning"] = reasoning
		}
	}

	if len(req.ResponseFormat) > 0 {
		out["response_format"] = req.ResponseFormat
	}

	if req.Stream {
		out["stream"] = true
		// Usage is captured from a trailing usage-only chunk.
		out["stream_options"] = map[string]any{"include_usage": true}
	}

	// Pass through unmodelled fields, except stream_options which is set above.
	for k, v := range req.Extra {
		if k == "stream_options" {
			continue
		}
		if _, set := out[k]; set {
			continue
		}
		out[k] = v
	}

	body, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("openai: render request: %w", err)
	}
	return body, nil
}

// renderOAIMessage converts one canonical message into wire messages. A
// role=tool message carrying several tool results expands to one wire message
// per result so each keeps its own tool_call_id.
func renderOAIMessage(m core.Message) []oaiMessage {
	role := m.Role
	if role == "" {
		// An empty role would serialize as "" and be rejected upstream.
		role = core.RoleUser
	}

	if role == core.RoleTool {
		var out []oaiMessage
		for _, p := range m.Content {
			if p.Type != core.PartToolResult || p.ToolResult == nil {
				continue
			}
			msg := oaiMessage{Role: string(core.RoleTool), ToolCallID: p.ToolResult.CallID}
			if p.ToolResult.Media != nil {
				content, _ := json.Marshal([]map[string]any{
					{"type": "text", "text": p.ToolResult.Content},
					{"type": "image_url", "image_url": map[string]any{"url": mediaURL(p.ToolResult.Media)}},
				})
				msg.Content = content
			} else {
				content, _ := json.Marshal(p.ToolResult.Content)
				msg.Content = content
			}
			out = append(out, msg)
		}
		return out
	}

	out := oaiMessage{Role: string(role), Name: m.Name}
	var texts []string
	var mediaParts []map[string]any
	var toolCalls []oaiToolCall

	for _, p := range m.Content {
		switch p.Type {
		case core.PartText:
			texts = append(texts, p.Text)
		case core.PartImage:
			if p.Media == nil {
				continue
			}
			mediaParts = append(mediaParts, map[string]any{
				"type":      "image_url",
				"image_url": map[string]any{"url": mediaURL(p.Media)},
			})
		case core.PartToolCall:
			if p.ToolCall == nil {
				continue
			}
			var tc oaiToolCall
			tc.ID = p.ToolCall.ID
			tc.Type = "function"
			tc.Function.Name = p.ToolCall.Name
			tc.Function.Arguments = string(p.ToolCall.Arguments)
			toolCalls = append(toolCalls, tc)
		case core.PartThinking:
			// Thinking is not part of the OpenAI chat wire format; drop it.
		}
	}

	switch {
	case len(mediaParts) > 0:
		// Multimodal messages use the array-of-parts content format.
		parts := mediaParts
		if len(texts) > 0 {
			parts = append([]map[string]any{{"type": "text", "text": strings.Join(texts, "")}}, mediaParts...)
		}
		content, _ := json.Marshal(parts)
		out.Content = content
	case len(texts) > 0:
		content, _ := json.Marshal(strings.Join(texts, ""))
		out.Content = content
	default:
		// Every message must carry a content field; strict OpenAI-compatible
		// upstreams reject a missing or null one.
		out.Content = json.RawMessage(`""`)
	}
	out.ToolCalls = toolCalls
	return []oaiMessage{out}
}

// ---- response parsing -------------------------------------------------------

type oaiUsage struct {
	PromptTokens        int `json:"prompt_tokens"`
	CompletionTokens    int `json:"completion_tokens"`
	TotalTokens         int `json:"total_tokens"`
	PromptTokensDetails *struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"prompt_tokens_details,omitempty"`
	CompletionTokensDetails *struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details,omitempty"`
}

type oaiResponseMessage struct {
	Role             string          `json:"role"`
	Content          json.RawMessage `json:"content"`
	ReasoningContent string          `json:"reasoning_content"`
	// Reasoning is an alternative field used by some providers.
	Reasoning string        `json:"reasoning"`
	ToolCalls []oaiToolCall `json:"tool_calls"`
}

type oaiResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Message      oaiResponseMessage `json:"message"`
		FinishReason string             `json:"finish_reason"`
	} `json:"choices"`
	Usage *oaiUsage `json:"usage"`
}

func (c OpenAICodec) ParseResponse(body []byte, model string) (*core.ChatResponse, error) {
	var raw oaiResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("openai: parse response: %w", err)
	}
	return c.buildResponse(raw, model), nil
}

// buildResponse converts a parsed oaiResponse into a canonical ChatResponse.
func (OpenAICodec) buildResponse(raw oaiResponse, model string) *core.ChatResponse {
	resp := &core.ChatResponse{
		ID:           raw.ID,
		Model:        cmp.Or(raw.Model, model),
		Message:      core.Message{Role: core.RoleAssistant},
		FinishReason: core.FinishStop,
	}
	if len(raw.Choices) == 0 {
		// A valid response with no completion (content filter, empty
		// aggregation) is not an upstream error.
		return resp
	}

	choice := raw.Choices[0]
	msg := core.Message{Role: core.RoleAssistant}

	thinking := choice.Message.ReasoningContent
	if thinking == "" {
		thinking = choice.Message.Reasoning
	}
	if thinking != "" {
		msg.Content = append(msg.Content, core.ContentPart{Type: core.PartThinking, Text: thinking})
	}
	msg.Content = append(msg.Content, decodeOAIContentParts(choice.Message.Content)...)
	for _, tc := range choice.Message.ToolCalls {
		msg.Content = append(msg.Content, core.ContentPart{
			Type: core.PartToolCall,
			ToolCall: &core.ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			},
		})
	}

	resp.Message = msg
	resp.FinishReason = mapOAIFinish(choice.FinishReason)
	if raw.Usage != nil {
		resp.Usage = *parseOAIUsage(raw.Usage)
	}
	return resp
}

// parseOAIUsage maps the OpenAI usage object, including the cached-prompt and
// reasoning-token detail blocks.
func parseOAIUsage(u *oaiUsage) *core.Usage {
	if u == nil {
		return nil
	}
	out := &core.Usage{
		PromptTokens:     u.PromptTokens,
		CompletionTokens: u.CompletionTokens,
		TotalTokens:      u.TotalTokens,
	}
	if u.PromptTokensDetails != nil {
		out.CachedTokens = u.PromptTokensDetails.CachedTokens
	}
	if u.CompletionTokensDetails != nil {
		out.ReasoningTokens = u.CompletionTokensDetails.ReasoningTokens
	}
	return out
}

func (OpenAICodec) RenderResponse(resp *core.ChatResponse) ([]byte, error) {
	out := map[string]any{
		"id":      cmp.Or(resp.ID, randomID("chatcmpl-")),
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   resp.Model,
		"choices": []any{renderOAIChoice(resp)},
		"usage":   renderOAIUsage(&resp.Usage),
	}
	body, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("openai: render response: %w", err)
	}
	return body, nil
}

// renderOAIUsage emits the OpenAI usage object, including the detail blocks
// when the canonical usage carries cached or reasoning tokens.
func renderOAIUsage(u *core.Usage) map[string]any {
	out := map[string]any{
		"prompt_tokens":     u.PromptTokens,
		"completion_tokens": u.CompletionTokens,
		"total_tokens":      u.TotalTokens,
	}
	if u.CachedTokens > 0 {
		out["prompt_tokens_details"] = map[string]any{"cached_tokens": u.CachedTokens}
	}
	if u.ReasoningTokens > 0 {
		out["completion_tokens_details"] = map[string]any{"reasoning_tokens": u.ReasoningTokens}
	}
	return out
}

func renderOAIChoice(resp *core.ChatResponse) map[string]any {
	message := map[string]any{"role": "assistant"}

	var text strings.Builder
	var thinking strings.Builder
	var mediaParts []map[string]any
	var toolCalls []map[string]any

	for _, p := range resp.Message.Content {
		switch p.Type {
		case core.PartText:
			text.WriteString(p.Text)
		case core.PartThinking:
			thinking.WriteString(p.Text)
		case core.PartImage:
			if p.Media == nil {
				continue
			}
			mediaParts = append(mediaParts, map[string]any{
				"type":      "image_url",
				"image_url": map[string]any{"url": mediaURL(p.Media)},
			})
		case core.PartToolCall:
			if p.ToolCall == nil {
				continue
			}
			toolCalls = append(toolCalls, map[string]any{
				"id":   p.ToolCall.ID,
				"type": "function",
				"function": map[string]string{
					"name":      p.ToolCall.Name,
					"arguments": string(p.ToolCall.Arguments),
				},
			})
		}
	}

	switch {
	case len(mediaParts) > 0:
		parts := mediaParts
		if text.Len() > 0 {
			parts = append([]map[string]any{{"type": "text", "text": text.String()}}, mediaParts...)
		}
		message["content"] = parts
	default:
		message["content"] = text.String()
	}
	if thinking.Len() > 0 {
		message["reasoning_content"] = thinking.String()
	}
	if len(toolCalls) > 0 {
		message["tool_calls"] = toolCalls
	}

	return map[string]any{
		"index":         0,
		"message":       message,
		"finish_reason": string(resp.FinishReason),
	}
}

func mapOAIFinish(r string) core.FinishReason {
	switch r {
	case "stop":
		return core.FinishStop
	case "length":
		return core.FinishLength
	case "tool_calls", "function_call":
		return core.FinishToolCalls
	case "content_filter":
		return core.FinishFilter
	default:
		return core.FinishStop
	}
}

// ---- streaming --------------------------------------------------------------

// oaiStreamChunk is one SSE data payload from an OpenAI streaming response.
type oaiStreamChunk struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Delta struct {
			Role             string `json:"role"`
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content"`
			// Reasoning is an alternative field some providers send.
			Reasoning string `json:"reasoning"`
			ToolCalls []struct {
				Index    int    `json:"index"`
				ID       string `json:"id"`
				Type     string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *oaiUsage `json:"usage"`
	// Error captures upstream SSE error events, which would otherwise
	// unmarshal into an empty chunk and be silently dropped.
	Error *oaiStreamError `json:"error"`
}

type oaiStreamError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// ParseStreamEvent decodes one upstream SSE event into canonical chunks. The
// "[DONE]" sentinel yields no chunks.
func (OpenAICodec) ParseStreamEvent(_ string, data []byte, state *StreamState) ([]core.StreamChunk, error) {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || bytes.Equal(data, []byte("[DONE]")) {
		return nil, nil
	}

	var raw oaiStreamChunk
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("openai: parse stream event: %w", err)
	}

	if raw.Error != nil {
		return []core.StreamChunk{{
			Type: core.ChunkError,
			Err: &core.ProviderError{
				Kind:    oaiStreamErrorKind(raw.Error),
				Message: oaiStreamErrorMessage(raw.Error),
			},
		}}, nil
	}

	if state != nil {
		if state.MessageID == "" && raw.ID != "" {
			state.MessageID = raw.ID
		}
		if state.Model == "" && raw.Model != "" {
			state.Model = raw.Model
		}
	}

	var chunks []core.StreamChunk
	if len(raw.Choices) > 0 {
		c := raw.Choices[0]
		reasoning := c.Delta.ReasoningContent
		if reasoning == "" {
			reasoning = c.Delta.Reasoning
		}
		if reasoning != "" {
			chunks = append(chunks, core.StreamChunk{Type: core.ChunkThinking, Delta: reasoning})
		}
		if c.Delta.Content != "" {
			chunks = append(chunks, core.StreamChunk{Type: core.ChunkText, Delta: c.Delta.Content})
		}
		for _, tc := range c.Delta.ToolCalls {
			chunks = append(chunks, core.StreamChunk{
				Type:  core.ChunkToolCall,
				Index: tc.Index,
				ToolCall: &core.ToolCall{
					ID:        tc.ID,
					Name:      tc.Function.Name,
					Arguments: json.RawMessage(tc.Function.Arguments),
				},
			})
		}
		if c.FinishReason != nil {
			chunks = append(chunks, core.StreamChunk{
				Type:         core.ChunkFinish,
				FinishReason: mapOAIFinish(*c.FinishReason),
			})
		}
	}

	if raw.Usage != nil {
		chunks = append(chunks, core.StreamChunk{Type: core.ChunkUsage, Usage: parseOAIUsage(raw.Usage)})
	}
	return chunks, nil
}

func oaiStreamErrorMessage(e *oaiStreamError) string {
	switch {
	case e.Type != "" && e.Message != "":
		return e.Type + ": " + e.Message
	case e.Message != "":
		return e.Message
	case e.Type != "":
		return e.Type
	default:
		return "upstream stream error"
	}
}

// oaiStreamErrorKind classifies an upstream stream error. Rate limiting and
// capacity problems are retryable; everything else is a generic upstream fault.
func oaiStreamErrorKind(e *oaiStreamError) core.ErrorKind {
	if core.LooksRateLimited(e.Type + " " + e.Code + " " + e.Message) {
		return core.ErrRateLimit
	}
	return core.ErrUpstream
}

// StreamState bookkeeping keys, stored in StreamState.Custom.
const (
	oaiKeySentRole   = "openai.sent_role"
	oaiKeyFinishSent = "openai.finish_sent"
	oaiKeyToolCalls  = "openai.tool_calls"
	oaiKeyMessageID  = "openai.message_id"
	oaiKeyToolIDs    = "openai.tool_call_ids"
	oaiKeyUsage      = "openai.usage"
)

// oaiEnsureMessageID returns the message id echoed on every chunk, minting and
// caching one when the caller did not preset it.
func oaiEnsureMessageID(state *StreamState) string {
	if state == nil {
		return randomID("chatcmpl-")
	}
	if state.MessageID != "" {
		return state.MessageID
	}
	if v, ok := state.Get(oaiKeyMessageID).(string); ok && v != "" {
		state.MessageID = v
		return v
	}
	id := randomID("chatcmpl-")
	state.MessageID = id
	state.Set(oaiKeyMessageID, id)
	return id
}

// oaiRoleDelta returns a fresh delta object, tagging the first emitted chunk of
// the stream with the assistant role per the OpenAI contract.
func oaiRoleDelta(state *StreamState) map[string]any {
	delta := map[string]any{}
	if state != nil && !state.Bool(oaiKeySentRole) {
		delta["role"] = "assistant"
		state.Set(oaiKeySentRole, true)
	}
	return delta
}

// oaiStreamToolCallID keeps one stable id per tool-call index across the
// fragment deltas of a streamed call.
func oaiStreamToolCallID(state *StreamState, index int, id, name string) string {
	if state == nil {
		if id != "" {
			return id
		}
		return randomID("call_")
	}
	ids, _ := state.Get(oaiKeyToolIDs).(map[int]string)
	if ids == nil {
		ids = map[int]string{}
		state.Set(oaiKeyToolIDs, ids)
	}
	if existing, ok := ids[index]; ok {
		return existing
	}
	resolved := id
	if resolved == "" {
		resolved = randomID("call_")
	}
	ids[index] = resolved
	return resolved
}

// RenderStreamChunk encodes a canonical chunk as OpenAI chat.completion.chunk
// SSE events.
func (OpenAICodec) RenderStreamChunk(chunk core.StreamChunk, state *StreamState) ([][]byte, error) {
	switch chunk.Type {
	case core.ChunkText:
		delta := oaiRoleDelta(state)
		delta["content"] = chunk.Delta
		return [][]byte{oaiChunkEvent(state, delta, nil)}, nil

	case core.ChunkThinking:
		delta := oaiRoleDelta(state)
		delta["reasoning_content"] = chunk.Delta
		return [][]byte{oaiChunkEvent(state, delta, nil)}, nil

	case core.ChunkToolCall:
		if chunk.ToolCall == nil {
			return nil, nil
		}
		state.Set(oaiKeyToolCalls, true)
		delta := oaiRoleDelta(state)
		// Arguments stream verbatim: an opening delta carries id+name with
		// empty arguments, and the client accumulates the later fragments.
		delta["tool_calls"] = []any{map[string]any{
			"index": chunk.Index,
			"id":    oaiStreamToolCallID(state, chunk.Index, chunk.ToolCall.ID, chunk.ToolCall.Name),
			"type":  "function",
			"function": map[string]string{
				"name":      chunk.ToolCall.Name,
				"arguments": string(chunk.ToolCall.Arguments),
			},
		}}
		return [][]byte{oaiChunkEvent(state, delta, nil)}, nil

	case core.ChunkFinish:
		state.Set(oaiKeyFinishSent, true)
		return [][]byte{oaiChunkEvent(state, map[string]any{}, new(string(chunk.FinishReason)))}, nil

	case core.ChunkUsage:
		// OpenAI clients expect usage exactly once, in a trailing chunk after
		// the finish. Upstreams (Anthropic) report usage piecemeal and before
		// any content, so fold it into state and emit it from RenderStreamDone.
		if chunk.Usage != nil && state != nil {
			acc, _ := state.Get(oaiKeyUsage).(core.Usage)
			acc.Merge(*chunk.Usage)
			// Some upstreams state a total below prompt+completion; the larger
			// figure wins so the trailing chunk is never an undercount.
			if total := acc.PromptTokens + acc.CompletionTokens; acc.TotalTokens < total {
				acc.TotalTokens = total
			}
			state.Set(oaiKeyUsage, acc)
		}
		return nil, nil

	case core.ChunkError:
		return [][]byte{oaiErrorEvent(chunk.Err)}, nil

	default:
		// ChunkPing and unknown types have no OpenAI wire representation.
		return nil, nil
	}
}

// RenderStreamDone closes the stream: if no finish chunk was emitted it emits
// one (tool_calls when tool calls were streamed, otherwise stop), then the
// accumulated usage chunk (when any usage was seen), then the [DONE] sentinel.
func (OpenAICodec) RenderStreamDone(state *StreamState) [][]byte {
	var out [][]byte
	if !state.Bool(oaiKeyFinishSent) {
		reason := string(core.FinishStop)
		if state.Bool(oaiKeyToolCalls) {
			reason = string(core.FinishToolCalls)
		}
		out = append(out, oaiChunkEvent(state, map[string]any{}, new(reason)))
	}
	if u, ok := state.Get(oaiKeyUsage).(core.Usage); ok {
		out = append(out, oaiUsageEvent(state, &u))
	}
	return append(out, []byte("data: [DONE]\n\n"))
}

// oaiChunkEvent renders one chat.completion.chunk event.
func oaiChunkEvent(state *StreamState, delta map[string]any, finish *string) []byte {
	choice := map[string]any{"index": 0, "delta": delta}
	if finish != nil {
		choice["finish_reason"] = *finish
	} else {
		choice["finish_reason"] = nil
	}
	payload := map[string]any{
		"id":      oaiEnsureMessageID(state),
		"object":  "chat.completion.chunk",
		"created": time.Now().Unix(),
		"model":   stateModel(state),
		"choices": []any{choice},
	}
	return sseJSON("", payload)
}

// oaiUsageEvent renders the trailing usage-only chunk (empty choices).
func oaiUsageEvent(state *StreamState, usage *core.Usage) []byte {
	payload := map[string]any{
		"id":      oaiEnsureMessageID(state),
		"object":  "chat.completion.chunk",
		"created": time.Now().Unix(),
		"model":   stateModel(state),
		"choices": []any{},
		"usage":   renderOAIUsage(usage),
	}
	return sseJSON("", payload)
}

// oaiErrorEvent renders a mid-stream error as an OpenAI-shaped error event.
func oaiErrorEvent(err error) []byte {
	msg := "upstream stream error"
	typ := string(core.ErrUpstream)
	if err != nil {
		if pe := core.AsProviderError(err); pe != nil {
			if pe.Message != "" {
				msg = pe.Message
			}
			if pe.Kind != "" {
				typ = string(pe.Kind)
			}
		} else {
			msg = err.Error()
		}
	}
	return sseJSON("", map[string]any{"error": map[string]any{"message": msg, "type": typ}})
}
