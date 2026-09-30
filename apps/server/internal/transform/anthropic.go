package transform

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"tera-router/server/internal/core"
)

// AnthropicCodec handles the Anthropic Messages wire format (/v1/messages),
// both directions and both unary and streaming.
type AnthropicCodec struct{}

// Dialect implements Codec.
func (AnthropicCodec) Dialect() core.Dialect { return core.DialectAnthropic }

// ---- max_tokens defaulting --------------------------------------------------

// antMaxTokensFloor is the output budget used when the client omitted
// max_tokens and the model is not a recognized Claude family member. Anthropic
// REQUIRES max_tokens on every request, so unlike the OpenAI dialect the codec
// can never leave it unset.
const antMaxTokensFloor = 8192

// antBareModelID strips a router alias prefix (e.g. "anthropic/") from a model
// id so the family heuristic sees the canonical bare id.
func antBareModelID(model string) string {
	if i := strings.IndexByte(model, '/'); i >= 0 {
		return model[i+1:]
	}
	return model
}

// defaultAntMaxTokensFor returns the max_tokens to send when the client did not
// specify one: the Claude family's published output ceiling when the model is
// recognized, else the conservative floor. Keeping this in one place means the
// renderer and any future caller agree on the default.
func defaultAntMaxTokensFor(model string) int {
	if c := claudeFamilyMaxTokens(antBareModelID(model)); c > 0 {
		return c
	}
	return antMaxTokensFloor
}

// claudeFamilyMaxTokens maps a Claude model id to its published output-token
// ceiling by family. Returns 0 for non-Claude ids so the caller falls through
// to the floor. Matching is substring-based and case-insensitive so it
// tolerates vendor prefixes and version suffixes a custom provider may attach
// (e.g. "claude-opus-4.8", "anthropic.claude-3-7-sonnet").
func claudeFamilyMaxTokens(model string) int {
	m := strings.ToLower(model)
	if !strings.Contains(m, "claude") {
		return 0
	}
	switch {
	case strings.Contains(m, "opus"):
		return 32000
	case strings.Contains(m, "haiku"), strings.Contains(m, "sonnet"):
		return 64000
	default:
		return 0
	}
}

// ---- reasoning budget mapping -----------------------------------------------

// antThinkingBudget resolves the thinking token budget a canonical reasoning
// config asks for. The second result reports whether thinking should be enabled
// at all: a nil config, an unknown effort, or "none" disables it.
func antThinkingBudget(r *core.ReasoningConfig) (int, bool) {
	if r == nil {
		return 0, false
	}
	if r.MaxTokens > 0 {
		return r.MaxTokens, true
	}
	switch strings.ToLower(strings.TrimSpace(r.Effort)) {
	case "low":
		return 1024, true
	case "medium", "med":
		return 4096, true
	case "high":
		return 16384, true
	case "xhigh", "x-high", "extra-high":
		return 32768, true
	default:
		return 0, false
	}
}

// antBudgetToEffort derives the canonical effort level for a thinking budget.
// Inverse of the table in antThinkingBudget.
func antBudgetToEffort(budget int) string {
	switch {
	case budget <= 0:
		return ""
	case budget <= 1024:
		return "low"
	case budget <= 4096:
		return "medium"
	case budget <= 16384:
		return "high"
	default:
		return "xhigh"
	}
}

// ---- wire types -------------------------------------------------------------

type antRequest struct {
	Model        string          `json:"model"`
	System       json.RawMessage `json:"system,omitempty"`
	Messages     []antMessage    `json:"messages"`
	Tools        []antTool       `json:"tools,omitempty"`
	ToolChoice   *antToolChoice  `json:"tool_choice,omitempty"`
	MaxTokens    int             `json:"max_tokens"`
	Stream       bool            `json:"stream,omitempty"`
	Temp         *float64        `json:"temperature,omitempty"`
	TopP         *float64        `json:"top_p,omitempty"`
	Stop         []string        `json:"stop_sequences,omitempty"`
	Thinking     *antThinking    `json:"thinking,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
	TopK         json.RawMessage `json:"top_k,omitempty"`
	OutputConfig *antOutputConf  `json:"output_config,omitempty"`
}

// antOutputConf preserves Anthropic's newer effort knob so it round-trips
// through Extra on same-dialect routing.
type antOutputConf struct {
	Effort string `json:"effort,omitempty"`
}

type antThinking struct {
	Type         string `json:"type"`
	BudgetTokens int    `json:"budget_tokens,omitempty"`
}

type antToolChoice struct {
	Type string `json:"type"`
	Name string `json:"name,omitempty"`
}

type antMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

type antBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   json.RawMessage `json:"content,omitempty"`
	IsError   bool            `json:"is_error,omitempty"`
	Source    *antImageSource `json:"source,omitempty"`
	Signature string          `json:"signature,omitempty"`
}

type antImageSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type,omitempty"`
	Data      string `json:"data,omitempty"`
	URL       string `json:"url,omitempty"`
}

type antTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	InputSchema json.RawMessage `json:"input_schema,omitempty"`
}

type antUsage struct {
	InputTokens              int `json:"input_tokens"`
	OutputTokens             int `json:"output_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
}

// ---- request parsing --------------------------------------------------------

// ParseRequest decodes an inbound /v1/messages body into canonical form.
func (AnthropicCodec) ParseRequest(body []byte) (*core.ChatRequest, error) {
	var raw antRequest
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("anthropic: parse request: %w", err)
	}

	req := &core.ChatRequest{
		Model:       raw.Model,
		System:      antDecodeSystem(raw.System),
		Temperature: raw.Temp,
		TopP:        raw.TopP,
		Stop:        raw.Stop,
		Stream:      raw.Stream,
	}
	if raw.MaxTokens > 0 {
		maxTokens := raw.MaxTokens
		req.MaxTokens = &maxTokens
	}
	if raw.Thinking != nil && raw.Thinking.BudgetTokens > 0 {
		req.Reasoning = &core.ReasoningConfig{
			MaxTokens: raw.Thinking.BudgetTokens,
			Effort:    antBudgetToEffort(raw.Thinking.BudgetTokens),
		}
	} else if raw.OutputConfig != nil && raw.OutputConfig.Effort != "" {
		req.Reasoning = &core.ReasoningConfig{Effort: raw.OutputConfig.Effort}
	}

	for _, t := range raw.Tools {
		req.Tools = append(req.Tools, core.Tool{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.InputSchema,
		})
	}
	req.ToolChoice = antParseToolChoice(raw.ToolChoice)

	for _, m := range raw.Messages {
		req.Messages = append(req.Messages, antParseMessages(m)...)
	}

	req.Extra = antParseExtra(raw.Metadata, raw.TopK)
	return req, nil
}

// antParseExtra captures the safe passthrough fields so a same-dialect
// upstream call can echo them back.
func antParseExtra(metadata, topK json.RawMessage) map[string]json.RawMessage {
	extra := map[string]json.RawMessage{}
	if len(bytes.TrimSpace(metadata)) > 0 && json.Valid(metadata) {
		extra["metadata"] = metadata
	}
	if len(bytes.TrimSpace(topK)) > 0 && json.Valid(topK) {
		extra["top_k"] = topK
	}
	if len(extra) == 0 {
		return nil
	}
	return extra
}

func antDecodeSystem(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var blocks []antBlock
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return ""
	}
	var out strings.Builder
	for _, b := range blocks {
		if b.Type == "text" {
			out.WriteString(b.Text)
		}
	}
	return out.String()
}

// antParseMessages converts one wire message into zero, one, or two canonical
// messages. A user turn carrying tool_result blocks becomes a RoleTool message;
// any remaining text/image blocks become a RoleUser message that follows it.
func antParseMessages(m antMessage) []core.Message {
	role := core.RoleUser
	if m.Role == "assistant" {
		role = core.RoleAssistant
	}

	// Content may be a plain string or an array of blocks.
	var s string
	if err := json.Unmarshal(m.Content, &s); err == nil {
		return []core.Message{{Role: role, Content: []core.ContentPart{{Type: core.PartText, Text: s}}}}
	}

	var blocks []antBlock
	if err := json.Unmarshal(m.Content, &blocks); err != nil {
		return nil
	}

	var toolResults []core.ContentPart
	var rest []core.ContentPart
	for _, b := range blocks {
		switch b.Type {
		case "text":
			rest = append(rest, core.ContentPart{Type: core.PartText, Text: b.Text})
		case "thinking":
			rest = append(rest, core.ContentPart{
				Type:      core.PartThinking,
				Text:      b.Text,
				Signature: b.Signature,
			})
		case "tool_use":
			rest = append(rest, core.ContentPart{
				Type:     core.PartToolCall,
				ToolCall: &core.ToolCall{ID: b.ID, Name: b.Name, Arguments: b.Input},
			})
		case "tool_result":
			toolResults = append(toolResults, core.ContentPart{
				Type: core.PartToolResult,
				ToolResult: &core.ToolResult{
					CallID:  b.ToolUseID,
					Content: antDecodeToolResultContent(b.Content),
					IsError: b.IsError,
				},
			})
		case "image":
			if b.Source != nil {
				rest = append(rest, core.ContentPart{Type: core.PartImage, Media: antMediaFromSource(b.Source)})
			}
		}
	}

	if len(toolResults) == 0 {
		if len(rest) == 0 {
			return nil
		}
		return []core.Message{{Role: role, Content: rest}}
	}

	out := []core.Message{{Role: core.RoleTool, Content: toolResults}}
	if len(rest) > 0 {
		out = append(out, core.Message{Role: role, Content: rest})
	}
	return out
}

func antMediaFromSource(s *antImageSource) *core.MediaPayload {
	if s.Type == "url" && s.URL != "" {
		return &core.MediaPayload{URL: s.URL}
	}
	return &core.MediaPayload{MIMEType: s.MediaType, Data: s.Data}
}

// antDecodeToolResultContent flattens a tool_result content payload (a plain
// string or an array of text blocks) into text.
func antDecodeToolResultContent(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var blocks []antBlock
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return string(raw)
	}
	var out strings.Builder
	for _, b := range blocks {
		if b.Type == "text" {
			out.WriteString(b.Text)
		}
	}
	return out.String()
}

// antParseToolChoice maps the Anthropic tool_choice shapes onto the canonical
// modes: auto -> auto, any -> required, tool -> function, none -> none.
func antParseToolChoice(tc *antToolChoice) *core.ToolChoice {
	if tc == nil {
		return nil
	}
	switch tc.Type {
	case "auto":
		return &core.ToolChoice{Mode: "auto"}
	case "any":
		return &core.ToolChoice{Mode: "required"}
	case "tool":
		return &core.ToolChoice{Mode: "function", Name: tc.Name}
	case "none":
		return &core.ToolChoice{Mode: "none"}
	default:
		return nil
	}
}

// antRenderToolChoice is the inverse of antParseToolChoice.
func antRenderToolChoice(tc *core.ToolChoice) *antToolChoice {
	if tc == nil {
		return nil
	}
	switch tc.Mode {
	case "auto":
		return &antToolChoice{Type: "auto"}
	case "required":
		return &antToolChoice{Type: "any"}
	case "function":
		return &antToolChoice{Type: "tool", Name: tc.Name}
	case "none":
		return &antToolChoice{Type: "none"}
	default:
		return nil
	}
}

// ---- request rendering ------------------------------------------------------

// RenderRequest encodes a canonical request into an Anthropic Messages body.
// providerID is accepted for interface compatibility; the Anthropic wire format
// has no provider-specific quirks in this port.
func (AnthropicCodec) RenderRequest(req *core.ChatRequest, _ string) ([]byte, error) {
	if req == nil {
		return nil, fmt.Errorf("anthropic: nil request")
	}

	// Anthropic requires max_tokens; when the client set one, honor it, when
	// not, default to the model family's ceiling (never the old 4096, which
	// truncates large tool calls mid-argument).
	maxTokens := defaultAntMaxTokensFor(req.Model)
	if req.MaxTokens != nil && *req.MaxTokens > 0 {
		maxTokens = *req.MaxTokens
	} else if req.MaxCompletionTokens != nil && *req.MaxCompletionTokens > 0 {
		maxTokens = *req.MaxCompletionTokens
	}

	out := antRequest{
		Model:     req.Model,
		MaxTokens: maxTokens,
		Stream:    req.Stream,
		Temp:      req.Temperature,
		TopP:      req.TopP,
		Stop:      req.Stop,
	}

	// Thinking and temperature/top_p are mutually exclusive upstream: Anthropic
	// rejects a request that sets both.
	if budget, ok := antThinkingBudget(req.Reasoning); ok {
		out.Thinking = &antThinking{Type: "enabled", BudgetTokens: budget}
		// Anthropic requires max_tokens > budget_tokens.
		if out.MaxTokens <= budget {
			out.MaxTokens = budget + 1024
		}
		out.Temp = nil
		out.TopP = nil
	}

	out.ToolChoice = antRenderToolChoice(req.ToolChoice)

	if req.System != "" {
		sys, err := json.Marshal(req.System)
		if err == nil {
			out.System = sys
		}
	}

	for _, t := range req.Tools {
		out.Tools = append(out.Tools, antTool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: antFillMissingToolSchemaTypes(t.Parameters),
		})
	}

	// Anthropic requires alternating user/assistant roles and carries tool
	// results as user-message blocks. Render each canonical message to a block
	// array and merge consecutive same-role messages.
	for _, m := range antEnsureLeadingUser(req.Messages) {
		role, blocks := antRenderMessage(m)
		out.Messages = append(out.Messages, antMessage{Role: role, Content: mustMarshal(blocks)})
	}
	out.Messages = antMergeMessages(out.Messages)

	if extra := req.Extra; extra != nil {
		if v, ok := extra["metadata"]; ok && len(bytes.TrimSpace(v)) > 0 && json.Valid(v) {
			out.Metadata = v
		}
		if v, ok := extra["top_k"]; ok && len(bytes.TrimSpace(v)) > 0 && json.Valid(v) {
			out.TopK = v
		}
	}

	return json.Marshal(out)
}

// antRenderMessage maps one canonical message to its Anthropic role and blocks.
func antRenderMessage(m core.Message) (string, []antBlock) {
	role := "user"
	if m.Role == core.RoleAssistant {
		role = "assistant"
	}
	return role, antRenderBlocks(m)
}

func antRenderBlocks(m core.Message) []antBlock {
	var blocks []antBlock
	for _, p := range m.Content {
		switch p.Type {
		case core.PartText:
			// Anthropic requires the "text" key on every text block, and Go's
			// omitempty would drop it for "" -> upstream 400. Skip empty text;
			// the placeholder fallback below covers an all-empty message.
			if p.Text != "" {
				blocks = append(blocks, antBlock{Type: "text", Text: p.Text})
			}
		case core.PartThinking:
			// Anthropic only accepts a thinking block that carries its
			// signature (the opaque bytes it issued). Unsigned thinking cannot
			// be replayed, so drop it rather than 400 the upstream call.
			if p.Signature == "" {
				continue
			}
			blocks = append(blocks, antBlock{Type: "thinking", Text: p.Text, Signature: p.Signature})
		case core.PartToolCall:
			// A nameless tool_use is unusable and Anthropic requires the name.
			if p.ToolCall == nil || p.ToolCall.Name == "" {
				continue
			}
			blocks = append(blocks, antBlock{
				Type:  "tool_use",
				ID:    p.ToolCall.ID,
				Name:  p.ToolCall.Name,
				Input: antNormalizeToolInput(p.ToolCall.Arguments),
			})
		case core.PartToolResult:
			if p.ToolResult == nil {
				continue
			}
			blocks = append(blocks, antRenderToolResult(p.ToolResult))
		case core.PartImage:
			if p.Media == nil {
				continue
			}
			if b, ok := antRenderImageBlock(p.Media); ok {
				blocks = append(blocks, b)
			}
		}
	}
	if len(blocks) == 0 {
		// Anthropic rejects empty content arrays; use a minimal placeholder.
		blocks = append(blocks, antBlock{Type: "text", Text: "."})
	}
	return blocks
}

func antRenderToolResult(tr *core.ToolResult) antBlock {
	if tr.Media == nil {
		return antBlock{
			Type:      "tool_result",
			ToolUseID: tr.CallID,
			Content:   mustMarshal(tr.Content),
			IsError:   tr.IsError,
		}
	}
	// Media results are rendered as a text description followed by an image
	// block so the model can "see" the tool output.
	content := []antBlock{{Type: "text", Text: tr.Content}}
	if b, ok := antRenderImageBlock(tr.Media); ok {
		content = append(content, b)
	}
	return antBlock{
		Type:      "tool_result",
		ToolUseID: tr.CallID,
		Content:   mustMarshal(content),
		IsError:   tr.IsError,
	}
}

func antRenderImageBlock(m *core.MediaPayload) (antBlock, bool) {
	switch {
	case m.Data != "":
		return antBlock{Type: "image", Source: &antImageSource{
			Type: "base64", MediaType: m.MIMEType, Data: m.Data,
		}}, true
	case m.URL != "":
		return antBlock{Type: "image", Source: &antImageSource{Type: "url", URL: m.URL}}, true
	default:
		return antBlock{}, false
	}
}

// antMergeMessages merges consecutive same-role messages (Anthropic forbids
// two turns with the same role in a row) and drops duplicate tool results
// (Anthropic requires exactly one result per tool_use id).
func antMergeMessages(msgs []antMessage) []antMessage {
	var out []antMessage
	var outBlocks [][]antBlock
	for _, m := range msgs {
		var blocks []antBlock
		if err := json.Unmarshal(m.Content, &blocks); err != nil {
			blocks = nil
		}
		if n := len(out); n > 0 && out[n-1].Role == m.Role {
			outBlocks[n-1] = append(outBlocks[n-1], blocks...)
			continue
		}
		out = append(out, antMessage{Role: m.Role})
		outBlocks = append(outBlocks, blocks)
	}
	for i := range out {
		outBlocks[i] = antDedupToolResults(outBlocks[i])
		out[i].Content = mustMarshal(outBlocks[i])
	}
	return out
}

// antDedupToolResults keeps only the last tool_result for each tool_use id.
func antDedupToolResults(blocks []antBlock) []antBlock {
	seen := make(map[string]int)
	dup := false
	for _, b := range blocks {
		if b.Type == "tool_result" && b.ToolUseID != "" {
			if _, ok := seen[b.ToolUseID]; ok {
				dup = true
				break
			}
			seen[b.ToolUseID] = 0
		}
	}
	if !dup {
		return blocks
	}
	seen = make(map[string]int)
	var kept []antBlock
	for _, b := range blocks {
		if b.Type == "tool_result" && b.ToolUseID != "" {
			if prev, ok := seen[b.ToolUseID]; ok {
				kept[prev] = b // last result wins
				continue
			}
			seen[b.ToolUseID] = len(kept)
		}
		kept = append(kept, b)
	}
	return kept
}

// antEnsureLeadingUser prepends a synthetic user turn when the conversation
// does not already start with one: the Messages API rejects conversations that
// begin with an assistant turn. It never mutates the input slice.
func antEnsureLeadingUser(messages []core.Message) []core.Message {
	if len(messages) == 0 || messages[0].Role == core.RoleUser {
		return messages
	}
	out := make([]core.Message, 0, len(messages)+1)
	out = append(out, core.Message{Role: core.RoleUser, Content: []core.ContentPart{{Type: core.PartText, Text: ""}}})
	return append(out, messages...)
}

// antFillMissingToolSchemaTypes adds type:"object" to any schema node with
// properties but no type, and type:"string" to enum nodes with no type.
// Anthropic-compatible upstreams (Moonshot/Kimi) reject typeless properties.
// An absent or unparsable schema degrades to the empty object schema.
func antFillMissingToolSchemaTypes(raw json.RawMessage) json.RawMessage {
	if len(bytes.TrimSpace(raw)) == 0 {
		return json.RawMessage(`{"type":"object"}`)
	}
	var node any
	if err := json.Unmarshal(raw, &node); err != nil {
		return json.RawMessage(`{"type":"object"}`)
	}
	antWalkSchemaTypes(node)
	out, err := json.Marshal(node)
	if err != nil {
		return json.RawMessage(`{"type":"object"}`)
	}
	return out
}

func antWalkSchemaTypes(node any) {
	if m, ok := antAsObj(node); ok {
		if _, hasType := m["type"]; !hasType {
			if _, hasProps := m["properties"]; hasProps {
				m["type"] = "object"
			} else if _, hasEnum := m["enum"]; hasEnum {
				m["type"] = "string"
			}
		}
	}
	antWalkChildren(node, antWalkSchemaTypes)
}

func antAsObj(node any) (map[string]any, bool) {
	m, ok := node.(map[string]any)
	return m, ok
}

func antWalkChildren(node any, fn func(any)) {
	switch v := node.(type) {
	case map[string]any:
		for _, child := range v {
			fn(child)
		}
	case []any:
		for _, child := range v {
			fn(child)
		}
	}
}

// antNormalizeToolInput ensures a tool_use input is a JSON object, as Anthropic
// requires. Anything that is not an object (empty, invalid, array, scalar)
// becomes {}.
func antNormalizeToolInput(raw json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && json.Valid(trimmed) && trimmed[0] == '{' {
		return trimmed
	}
	return json.RawMessage(`{}`)
}

func antToolInputValue(raw json.RawMessage) any {
	var input map[string]any
	if err := json.Unmarshal(antNormalizeToolInput(raw), &input); err != nil {
		return map[string]any{}
	}
	return input
}

func mustMarshal(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage(`null`)
	}
	return b
}

// ---- response parsing -------------------------------------------------------

type antResponse struct {
	ID         string     `json:"id"`
	Model      string     `json:"model"`
	Content    []antBlock `json:"content"`
	StopReason string     `json:"stop_reason"`
	Usage      antUsage   `json:"usage"`
}

// ParseResponse decodes a unary Messages response into canonical form.
func (AnthropicCodec) ParseResponse(body []byte, model string) (*core.ChatResponse, error) {
	var raw antResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("anthropic: parse response: %w", err)
	}

	msg := core.Message{Role: core.RoleAssistant}
	for _, b := range raw.Content {
		switch b.Type {
		case "text":
			msg.Content = append(msg.Content, core.ContentPart{Type: core.PartText, Text: b.Text})
		case "thinking":
			msg.Content = append(msg.Content, core.ContentPart{
				Type:      core.PartThinking,
				Text:      b.Text,
				Signature: b.Signature,
			})
		case "tool_use":
			msg.Content = append(msg.Content, core.ContentPart{
				Type:     core.PartToolCall,
				ToolCall: &core.ToolCall{ID: b.ID, Name: b.Name, Arguments: antNormalizeToolInput(b.Input)},
			})
		}
	}

	return &core.ChatResponse{
		ID:           raw.ID,
		Model:        antFirstNonEmpty(raw.Model, model),
		Message:      msg,
		FinishReason: mapAntStop(raw.StopReason),
		Usage:        antUsageToCanonical(raw.Usage),
	}, nil
}

// RenderResponse encodes a canonical response as a Messages response body.
func (AnthropicCodec) RenderResponse(resp *core.ChatResponse) ([]byte, error) {
	if resp == nil {
		return nil, fmt.Errorf("anthropic: nil response")
	}

	content := make([]map[string]any, 0, len(resp.Message.Content))
	for _, p := range resp.Message.Content {
		switch p.Type {
		case core.PartText:
			content = append(content, map[string]any{"type": "text", "text": p.Text})
		case core.PartThinking:
			block := map[string]any{"type": "thinking", "thinking": p.Text}
			if p.Signature != "" {
				block["signature"] = p.Signature
			}
			content = append(content, block)
		case core.PartToolCall:
			if p.ToolCall == nil {
				continue
			}
			content = append(content, map[string]any{
				"type":  "tool_use",
				"id":    p.ToolCall.ID,
				"name":  p.ToolCall.Name,
				"input": antToolInputValue(p.ToolCall.Arguments),
			})
		}
	}

	usage := map[string]any{
		"input_tokens":  antWireInputTokens(resp.Usage),
		"output_tokens": resp.Usage.CompletionTokens,
	}
	if resp.Usage.CachedTokens > 0 {
		usage["cache_read_input_tokens"] = resp.Usage.CachedTokens
	}
	if resp.Usage.CacheWriteTokens > 0 {
		usage["cache_creation_input_tokens"] = resp.Usage.CacheWriteTokens
	}

	out := map[string]any{
		"id":            antFirstNonEmpty(resp.ID, antRandomID("msg_")),
		"type":          "message",
		"role":          "assistant",
		"model":         resp.Model,
		"content":       content,
		"stop_reason":   renderAntStop(resp.FinishReason),
		"stop_sequence": nil,
		"usage":         usage,
	}
	return json.Marshal(out)
}

// antWireInputTokens converts canonical prompt tokens back to Anthropic's
// uncached input_tokens. Canonical PromptTokens includes cache reads/writes, so
// subtracting them recovers the billed-as-input remainder (never negative).
func antWireInputTokens(u core.Usage) int {
	n := u.PromptTokens - u.CachedTokens - u.CacheWriteTokens
	if n < 0 {
		return 0
	}
	return n
}

// antUsageToCanonical applies the contract's Anthropic usage mapping:
// canonical PromptTokens = input + cache_read + cache_write.
func antUsageToCanonical(u antUsage) core.Usage {
	prompt := u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens
	return core.Usage{
		PromptTokens:     prompt,
		CompletionTokens: u.OutputTokens,
		TotalTokens:      prompt + u.OutputTokens,
		CachedTokens:     u.CacheReadInputTokens,
		CacheWriteTokens: u.CacheCreationInputTokens,
	}
}

func mapAntStop(r string) core.FinishReason {
	switch r {
	case "end_turn", "stop_sequence":
		return core.FinishStop
	case "max_tokens":
		return core.FinishLength
	case "tool_use":
		return core.FinishToolCalls
	case "refusal":
		return core.FinishFilter
	default:
		return core.FinishStop
	}
}

func renderAntStop(r core.FinishReason) string {
	switch r {
	case core.FinishLength:
		return "max_tokens"
	case core.FinishToolCalls:
		return "tool_use"
	case core.FinishFilter:
		return "refusal"
	default:
		return "end_turn"
	}
}

// ---- shared small helpers ---------------------------------------------------

func antFirstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func antRandomID(prefix string) string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + "000000000000000000000000"
	}
	return prefix + hex.EncodeToString(b[:])
}
