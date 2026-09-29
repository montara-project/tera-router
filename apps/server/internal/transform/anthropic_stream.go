package transform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"tera-router/server/internal/core"
)

// Anthropic streams typed SSE events rather than uniform chunks:
//
//	message_start → content_block_start → content_block_delta* →
//	content_block_stop → message_delta → message_stop
//
// ParseStreamEvent maps the payload of each event to canonical chunks;
// RenderStreamChunk produces the corresponding event sequence for a client that
// speaks Anthropic.
//
// Stream state (StreamState.Custom) keys used here:
//
//	"sent_start"    bool  — message_start already emitted
//	"sent_delta"    bool  — message_delta already emitted
//	"open_block"    int   — wire index of the currently open content block (-1 = none)
//	"open_kind"     string— "text" | "thinking" | "tool_use"
//	"next_index"    int   — next free content-block index
//	"tool_by_index" map[int]int — upstream wire block index → tool-call index
//	"usage"         core.Usage — cumulative usage (parse side)
//	"usage_out"     int   — output tokens to report on message_delta (render side)

// antStreamEvent is the union of every Anthropic stream event payload we read.
type antStreamEvent struct {
	Type    string `json:"type"`
	Index   int    `json:"index"`
	Message *struct {
		ID    string   `json:"id"`
		Model string   `json:"model"`
		Usage antUsage `json:"usage"`
	} `json:"message"`
	ContentBlock struct {
		Type string `json:"type"`
		ID   string `json:"id"`
		Name string `json:"name"`
		Text string `json:"text"`
	} `json:"content_block"`
	Delta struct {
		Type        string `json:"type"`
		Text        string `json:"text"`
		Thinking    string `json:"thinking"`
		Signature   string `json:"signature"`
		PartialJSON string `json:"partial_json"`
		StopReason  string `json:"stop_reason"`
	} `json:"delta"`
	Usage *antUsage `json:"usage"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// ParseStreamEvent converts one Anthropic SSE event into canonical chunks.
func (AnthropicCodec) ParseStreamEvent(event string, data []byte, state *StreamState) ([]core.StreamChunk, error) {
	payload := bytes.TrimSpace(data)
	if len(payload) == 0 {
		return nil, nil
	}

	var ev antStreamEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return nil, fmt.Errorf("anthropic: parse stream event: %w", err)
	}
	if ev.Type == "" {
		ev.Type = event
	}

	switch ev.Type {
	case "message_start":
		if ev.Message == nil {
			return nil, nil
		}
		if state != nil {
			if state.MessageID == "" {
				state.MessageID = ev.Message.ID
			}
			if state.Model == "" {
				state.Model = ev.Message.Model
			}
			antAddUsage(state, ev.Message.Usage)
		}
		u := antUsageToCanonical(ev.Message.Usage)
		return []core.StreamChunk{{Type: core.ChunkUsage, Usage: &u}}, nil

	case "content_block_start":
		if ev.ContentBlock.Type != "tool_use" {
			return nil, nil
		}
		idx := 0
		if state != nil {
			idx = antToolIndexFor(state, ev.Index)
		}
		return []core.StreamChunk{{
			Type:  core.ChunkToolCall,
			Index: idx,
			ToolCall: &core.ToolCall{
				ID:   ev.ContentBlock.ID,
				Name: ev.ContentBlock.Name,
			},
		}}, nil

	case "content_block_delta":
		switch ev.Delta.Type {
		case "text_delta":
			if ev.Delta.Text == "" {
				return nil, nil
			}
			return []core.StreamChunk{{Type: core.ChunkText, Delta: ev.Delta.Text}}, nil
		case "thinking_delta":
			if ev.Delta.Thinking == "" {
				return nil, nil
			}
			return []core.StreamChunk{{Type: core.ChunkThinking, Delta: ev.Delta.Thinking}}, nil
		case "signature_delta":
			if ev.Delta.Signature == "" {
				return nil, nil
			}
			return []core.StreamChunk{{Type: core.ChunkThinking, Signature: ev.Delta.Signature}}, nil
		case "input_json_delta":
			if ev.Delta.PartialJSON == "" {
				return nil, nil
			}
			idx := 0
			if state != nil {
				idx = antToolIndexFor(state, ev.Index)
			}
			return []core.StreamChunk{{
				Type:     core.ChunkToolCall,
				Index:    idx,
				ToolCall: &core.ToolCall{Arguments: json.RawMessage(ev.Delta.PartialJSON)},
			}}, nil
		default:
			return nil, nil
		}

	case "message_delta":
		var chunks []core.StreamChunk
		if ev.Delta.StopReason != "" {
			chunks = append(chunks, core.StreamChunk{
				Type:         core.ChunkFinish,
				FinishReason: mapAntStop(ev.Delta.StopReason),
			})
		}
		if ev.Usage != nil {
			if state != nil {
				// message_delta carries cumulative output tokens; merge so the
				// emitted usage always reports the full picture (input from
				// message_start plus the final output count).
				antAddUsage(state, *ev.Usage)
				u := antStateUsage(state)
				chunks = append(chunks, core.StreamChunk{Type: core.ChunkUsage, Usage: &u})
			} else {
				u := antUsageToCanonical(*ev.Usage)
				chunks = append(chunks, core.StreamChunk{Type: core.ChunkUsage, Usage: &u})
			}
		}
		return chunks, nil

	case "error":
		msg := "anthropic stream error"
		if ev.Error != nil && ev.Error.Message != "" {
			msg = ev.Error.Message
		}
		kind := core.ErrUpstream
		if antLooksRateLimited(msg) {
			kind = core.ErrRateLimit
		}
		return []core.StreamChunk{{
			Type: core.ChunkError,
			Err:  &core.ProviderError{Kind: kind, Message: msg},
		}}, nil

	default:
		// message_stop, content_block_stop, ping: nothing canonical to emit.
		return nil, nil
	}
}

// antLooksRateLimited recognizes the overload/quota wording Anthropic uses when
// it rejects a stream mid-flight, so the dispatcher can cool the account down
// instead of treating it as a transient upstream fault.
func antLooksRateLimited(msg string) bool {
	m := strings.ToLower(msg)
	return strings.Contains(m, "rate limit") ||
		strings.Contains(m, "overloaded") ||
		strings.Contains(m, "quota") ||
		strings.Contains(m, "too many requests")
}

// antToolIndexFor maps an upstream content-block index to a compact 0-based
// tool-call index, allocating the next one on first sight.
func antToolIndexFor(state *StreamState, blockIndex int) int {
	if state == nil {
		return blockIndex
	}
	if state.Custom == nil {
		state.Custom = map[string]any{}
	}
	m, _ := state.Custom["tool_by_index"].(map[int]int)
	if m == nil {
		m = map[int]int{}
		state.Custom["tool_by_index"] = m
	}
	if idx, ok := m[blockIndex]; ok {
		return idx
	}
	idx := len(m)
	m[blockIndex] = idx
	return idx
}

// antAddUsage accumulates a partial Anthropic usage record into the stream
// state, overwriting only the fields the event actually reported.
func antAddUsage(state *StreamState, u antUsage) {
	if state == nil {
		return
	}
	if state.Custom == nil {
		state.Custom = map[string]any{}
	}
	cur, _ := state.Custom["usage"].(core.Usage)
	if u.InputTokens > 0 || u.CacheReadInputTokens > 0 || u.CacheCreationInputTokens > 0 {
		prompt := u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens
		cur.PromptTokens = prompt
		cur.CachedTokens = u.CacheReadInputTokens
		cur.CacheWriteTokens = u.CacheCreationInputTokens
	}
	if u.OutputTokens > 0 {
		cur.CompletionTokens = u.OutputTokens
	}
	cur.TotalTokens = cur.PromptTokens + cur.CompletionTokens
	state.Custom["usage"] = cur
}

func antStateUsage(state *StreamState) core.Usage {
	if state == nil || state.Custom == nil {
		return core.Usage{}
	}
	u, _ := state.Custom["usage"].(core.Usage)
	return u
}

// ---- stream rendering -------------------------------------------------------

// antEvent formats a named Anthropic SSE event: "event: <name>\ndata: <json>\n\n".
func antEvent(name string, payload map[string]any) []byte {
	b, err := json.Marshal(payload)
	if err != nil {
		b = []byte(`{}`)
	}
	out := make([]byte, 0, len(name)+len(b)+20)
	out = append(out, "event: "...)
	out = append(out, name...)
	out = append(out, '\n')
	out = append(out, "data: "...)
	out = append(out, b...)
	out = append(out, '\n', '\n')
	return out
}

// antStateInt reads an int bookkeeping value with a default.
func antStateInt(state *StreamState, key string, def int) int {
	if state == nil || state.Custom == nil {
		return def
	}
	if v, ok := state.Custom[key].(int); ok {
		return v
	}
	return def
}

func antSet(state *StreamState, key string, val any) {
	if state == nil {
		return
	}
	if state.Custom == nil {
		state.Custom = map[string]any{}
	}
	state.Custom[key] = val
}

func antStateBool(state *StreamState, key string) bool {
	if state == nil || state.Custom == nil {
		return false
	}
	v, _ := state.Custom[key].(bool)
	return v
}

// antRenderMessageStart emits the opening message_start event, once per stream.
// Input tokens are reported from the accumulated usage when the upstream
// supplied them, else 0.
func antRenderMessageStart(state *StreamState) []byte {
	antSet(state, "sent_start", true)
	usage := antStateUsage(state)
	id := "msg_stream"
	if state != nil && state.MessageID != "" {
		id = state.MessageID
	}
	model := ""
	if state != nil {
		model = state.Model
	}
	return antEvent("message_start", map[string]any{
		"type": "message_start",
		"message": map[string]any{
			"id":            id,
			"type":          "message",
			"role":          "assistant",
			"model":         model,
			"content":       []any{},
			"stop_reason":   nil,
			"stop_sequence": nil,
			"usage": map[string]any{
				"input_tokens":                usage.PromptTokens,
				"output_tokens":               0,
				"cache_read_input_tokens":     usage.CachedTokens,
				"cache_creation_input_tokens": usage.CacheWriteTokens,
			},
		},
	})
}

// antCloseOpenBlock emits content_block_stop for the currently open block and
// allocates the next index.
func antCloseOpenBlock(state *StreamState) [][]byte {
	idx := antStateInt(state, "open_block", -1)
	if idx < 0 {
		return nil
	}
	events := [][]byte{antEvent("content_block_stop", map[string]any{
		"type": "content_block_stop", "index": idx,
	})}
	antSet(state, "open_block", -1)
	antSet(state, "open_kind", "")
	antSet(state, "next_index", idx+1)
	return events
}

// antOpenBlock emits content_block_start for a new block of the given kind,
// closing whatever block was open first.
func antOpenBlock(state *StreamState, kind string, extra map[string]any) [][]byte {
	events := antCloseOpenBlock(state)
	idx := antStateInt(state, "next_index", 0)
	block := map[string]any{"type": kind}
	for k, v := range extra {
		block[k] = v
	}
	events = append(events, antEvent("content_block_start", map[string]any{
		"type": "content_block_start", "index": idx, "content_block": block,
	}))
	antSet(state, "open_block", idx)
	antSet(state, "open_kind", kind)
	return events
}

// RenderStreamChunk emits the Anthropic events for one canonical chunk,
// lazily opening the message and a content block of the right kind.
func (AnthropicCodec) RenderStreamChunk(chunk core.StreamChunk, state *StreamState) ([][]byte, error) {
	if state == nil {
		return nil, fmt.Errorf("anthropic: render stream chunk: nil state")
	}
	var events [][]byte

	switch chunk.Type {
	case core.ChunkPing:
		return nil, nil

	case core.ChunkError:
		msg := "stream error"
		if chunk.Err != nil {
			msg = chunk.Err.Error()
		}
		return [][]byte{antEvent("error", map[string]any{
			"type":  "error",
			"error": map[string]any{"type": "api_error", "message": msg},
		})}, nil

	case core.ChunkUsage:
		// Usage is folded into the state; Anthropic reports it on
		// message_start and message_delta, not as its own event.
		if chunk.Usage != nil {
			u := antStateUsage(state)
			if chunk.Usage.PromptTokens > 0 {
				u.PromptTokens = chunk.Usage.PromptTokens
				u.CachedTokens = chunk.Usage.CachedTokens
				u.CacheWriteTokens = chunk.Usage.CacheWriteTokens
			}
			if chunk.Usage.CompletionTokens > 0 {
				u.CompletionTokens = chunk.Usage.CompletionTokens
			}
			u.TotalTokens = u.PromptTokens + u.CompletionTokens
			antSet(state, "usage", u)
		}
		return nil, nil
	}

	if !antStateBool(state, "sent_start") {
		events = append(events, antRenderMessageStart(state))
	}

	switch chunk.Type {
	case core.ChunkText:
		if chunk.Delta == "" {
			break
		}
		if antStateInt(state, "open_block", -1) < 0 || antStateString(state, "open_kind") != "text" {
			events = append(events, antOpenBlock(state, "text", map[string]any{"text": ""})...)
		}
		events = append(events, antEvent("content_block_delta", map[string]any{
			"type":  "content_block_delta",
			"index": antStateInt(state, "open_block", 0),
			"delta": map[string]any{"type": "text_delta", "text": chunk.Delta},
		}))

	case core.ChunkThinking:
		if chunk.Signature != "" {
			// A signature delta only makes sense on an open thinking block.
			if antStateInt(state, "open_block", -1) < 0 || antStateString(state, "open_kind") != "thinking" {
				events = append(events, antOpenBlock(state, "thinking", map[string]any{"thinking": ""})...)
			}
			events = append(events, antEvent("content_block_delta", map[string]any{
				"type":  "content_block_delta",
				"index": antStateInt(state, "open_block", 0),
				"delta": map[string]any{"type": "signature_delta", "signature": chunk.Signature},
			}))
			break
		}
		if chunk.Delta == "" {
			break
		}
		if antStateInt(state, "open_block", -1) < 0 || antStateString(state, "open_kind") != "thinking" {
			events = append(events, antOpenBlock(state, "thinking", map[string]any{"thinking": ""})...)
		}
		events = append(events, antEvent("content_block_delta", map[string]any{
			"type":  "content_block_delta",
			"index": antStateInt(state, "open_block", 0),
			"delta": map[string]any{"type": "thinking_delta", "thinking": chunk.Delta},
		}))

	case core.ChunkToolCall:
		if chunk.ToolCall == nil {
			break
		}
		openKind := antStateString(state, "open_kind")
		// The first chunk of a tool call carries its id: open a fresh block.
		if chunk.ToolCall.ID != "" {
			if openKind != "tool_use" || chunk.Index != antStateInt(state, "open_tool_index", -1) {
				events = append(events, antOpenBlock(state, "tool_use", map[string]any{
					"id": chunk.ToolCall.ID, "name": chunk.ToolCall.Name, "input": map[string]any{},
				})...)
				antSet(state, "open_tool_index", chunk.Index)
			}
		} else if openKind != "tool_use" {
			// Argument fragments for a call we never saw the header of: skip.
			break
		}
		args := strings.TrimSpace(string(chunk.ToolCall.Arguments))
		if args != "" && args != "{}" && args != "[]" {
			events = append(events, antEvent("content_block_delta", map[string]any{
				"type":  "content_block_delta",
				"index": antStateInt(state, "open_block", 0),
				"delta": map[string]any{"type": "input_json_delta", "partial_json": args},
			}))
		}

	case core.ChunkFinish:
		events = append(events, antCloseOpenBlock(state)...)
		// A second finish chunk (defensive: some upstreams repeat it) must not
		// emit a second message_delta.
		if !antStateBool(state, "sent_delta") {
			events = append(events, antRenderMessageDelta(state, renderAntStop(chunk.FinishReason)))
		}

	default:
		return events, nil
	}

	return events, nil
}

// antRenderMessageDelta emits the single message_delta event carrying the stop
// reason and the accumulated usage. Anthropic reports cumulative usage here
// (input tokens included), which matters because the canonical usage chunk
// typically arrives after message_start was already flushed.
func antRenderMessageDelta(state *StreamState, stopReason string) []byte {
	antSet(state, "sent_delta", true)
	usage := antStateUsage(state)
	payload := map[string]any{
		"type":  "message_delta",
		"delta": map[string]any{"stop_reason": stopReason, "stop_sequence": nil},
		"usage": map[string]any{
			"input_tokens":  usage.PromptTokens,
			"output_tokens": usage.CompletionTokens,
		},
	}
	if usage.CachedTokens > 0 {
		payload["usage"].(map[string]any)["cache_read_input_tokens"] = usage.CachedTokens
	}
	if usage.CacheWriteTokens > 0 {
		payload["usage"].(map[string]any)["cache_creation_input_tokens"] = usage.CacheWriteTokens
	}
	return antEvent("message_delta", payload)
}

func antStateString(state *StreamState, key string) string {
	if state == nil || state.Custom == nil {
		return ""
	}
	v, _ := state.Custom[key].(string)
	return v
}

// RenderStreamDone closes the stream: it guarantees message_start and
// message_delta were emitted and finishes with message_stop.
func (AnthropicCodec) RenderStreamDone(state *StreamState) [][]byte {
	if state == nil {
		return nil
	}
	var events [][]byte
	if !antStateBool(state, "sent_start") {
		events = append(events, antRenderMessageStart(state))
	}
	events = append(events, antCloseOpenBlock(state)...)
	if !antStateBool(state, "sent_delta") {
		events = append(events, antRenderMessageDelta(state, renderAntStop(core.FinishStop)))
	}
	events = append(events, antEvent("message_stop", map[string]any{"type": "message_stop"}))
	return events
}
