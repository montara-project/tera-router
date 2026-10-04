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
//	"open_tool_index" int — canonical index of the open tool_use block
//	"next_index"    int   — next free content-block index
//	"tool_by_index" map[int]int — upstream wire block index → tool-call index
//	"usage"         core.Usage — cumulative usage (parse side)

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
				u, _ := state.Get("usage").(core.Usage)
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
		if core.LooksRateLimited(msg) {
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

// antToolIndexFor maps an upstream content-block index to a compact 0-based
// tool-call index, allocating the next one on first sight.
func antToolIndexFor(state *StreamState, blockIndex int) int {
	if state == nil {
		return blockIndex
	}
	m, _ := state.Get("tool_by_index").(map[int]int)
	if m == nil {
		m = map[int]int{}
		state.Set("tool_by_index", m)
	}
	if idx, ok := m[blockIndex]; ok {
		return idx
	}
	idx := len(m)
	m[blockIndex] = idx
	return idx
}

// antAddUsage accumulates a partial Anthropic usage record into the stream
// state. Anthropic reports the input/cache counts as one cumulative group and
// the output count separately, so the input group replaces the previous one
// wholesale (a zero cache count clears a prior value) rather than overlaying
// per field. The total is always recomputed from the merged counts.
func antAddUsage(state *StreamState, u antUsage) {
	if state == nil {
		return
	}
	cur, _ := state.Get("usage").(core.Usage)
	if u.InputTokens > 0 || u.CacheReadInputTokens > 0 || u.CacheCreationInputTokens > 0 {
		cur.PromptTokens = u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens
		cur.CachedTokens = u.CacheReadInputTokens
		cur.CacheWriteTokens = u.CacheCreationInputTokens
	}
	if u.OutputTokens > 0 {
		cur.CompletionTokens = u.OutputTokens
	}
	cur.TotalTokens = cur.PromptTokens + cur.CompletionTokens
	state.Set("usage", cur)
}

// ---- stream rendering -------------------------------------------------------

// antRenderMessageStart emits the opening message_start event, once per stream.
// Input tokens are reported from the accumulated usage when the upstream
// supplied them, else 0.
func antRenderMessageStart(state *StreamState) []byte {
	state.Set("sent_start", true)
	usage, _ := state.Get("usage").(core.Usage)
	id := "msg_stream"
	if state != nil && state.MessageID != "" {
		id = state.MessageID
	}
	return sseJSON("message_start", map[string]any{
		"type": "message_start",
		"message": map[string]any{
			"id":            id,
			"type":          "message",
			"role":          "assistant",
			"model":         stateModel(state),
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
	idx := state.Int("open_block", -1)
	if idx < 0 {
		return nil
	}
	events := [][]byte{sseJSON("content_block_stop", map[string]any{
		"type": "content_block_stop", "index": idx,
	})}
	state.Set("open_block", -1)
	state.Set("open_kind", "")
	state.Set("next_index", idx+1)
	return events
}

// antOpenBlock emits content_block_start for a new block of the given kind,
// closing whatever block was open first.
func antOpenBlock(state *StreamState, kind string, extra map[string]any) [][]byte {
	events := antCloseOpenBlock(state)
	idx := state.Int("next_index", 0)
	block := map[string]any{"type": kind}
	for k, v := range extra {
		block[k] = v
	}
	events = append(events, sseJSON("content_block_start", map[string]any{
		"type": "content_block_start", "index": idx, "content_block": block,
	}))
	state.Set("open_block", idx)
	state.Set("open_kind", kind)
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
		return [][]byte{sseJSON("error", map[string]any{
			"type":  "error",
			"error": map[string]any{"type": "api_error", "message": msg},
		})}, nil

	case core.ChunkUsage:
		// Usage is folded into the state; Anthropic reports it on
		// message_start and message_delta, not as its own event.
		if chunk.Usage != nil {
			u, _ := state.Get("usage").(core.Usage)
			if chunk.Usage.PromptTokens > 0 {
				u.PromptTokens = chunk.Usage.PromptTokens
				u.CachedTokens = chunk.Usage.CachedTokens
				u.CacheWriteTokens = chunk.Usage.CacheWriteTokens
			}
			if chunk.Usage.CompletionTokens > 0 {
				u.CompletionTokens = chunk.Usage.CompletionTokens
			}
			u.TotalTokens = u.PromptTokens + u.CompletionTokens
			state.Set("usage", u)
		}
		return nil, nil
	}

	if !state.Bool("sent_start") {
		events = append(events, antRenderMessageStart(state))
	}

	switch chunk.Type {
	case core.ChunkText:
		if chunk.Delta == "" {
			break
		}
		if state.Int("open_block", -1) < 0 || state.String("open_kind") != "text" {
			events = append(events, antOpenBlock(state, "text", map[string]any{"text": ""})...)
		}
		events = append(events, sseJSON("content_block_delta", map[string]any{
			"type":  "content_block_delta",
			"index": state.Int("open_block", 0),
			"delta": map[string]any{"type": "text_delta", "text": chunk.Delta},
		}))

	case core.ChunkThinking:
		if chunk.Signature != "" {
			// A signature delta only makes sense on an open thinking block.
			if state.Int("open_block", -1) < 0 || state.String("open_kind") != "thinking" {
				events = append(events, antOpenBlock(state, "thinking", map[string]any{"thinking": ""})...)
			}
			events = append(events, sseJSON("content_block_delta", map[string]any{
				"type":  "content_block_delta",
				"index": state.Int("open_block", 0),
				"delta": map[string]any{"type": "signature_delta", "signature": chunk.Signature},
			}))
			break
		}
		if chunk.Delta == "" {
			break
		}
		if state.Int("open_block", -1) < 0 || state.String("open_kind") != "thinking" {
			events = append(events, antOpenBlock(state, "thinking", map[string]any{"thinking": ""})...)
		}
		events = append(events, sseJSON("content_block_delta", map[string]any{
			"type":  "content_block_delta",
			"index": state.Int("open_block", 0),
			"delta": map[string]any{"type": "thinking_delta", "thinking": chunk.Delta},
		}))

	case core.ChunkToolCall:
		if chunk.ToolCall == nil {
			break
		}
		openKind := state.String("open_kind")
		// The first chunk of a tool call carries its id: open a fresh block.
		if chunk.ToolCall.ID != "" {
			if openKind != "tool_use" || chunk.Index != state.Int("open_tool_index", -1) {
				events = append(events, antOpenBlock(state, "tool_use", map[string]any{
					"id": chunk.ToolCall.ID, "name": chunk.ToolCall.Name, "input": map[string]any{},
				})...)
				state.Set("open_tool_index", chunk.Index)
			}
		} else if openKind != "tool_use" {
			// Argument fragments for a call we never saw the header of: skip.
			break
		}
		args := strings.TrimSpace(string(chunk.ToolCall.Arguments))
		if args != "" && args != "{}" && args != "[]" {
			events = append(events, sseJSON("content_block_delta", map[string]any{
				"type":  "content_block_delta",
				"index": state.Int("open_block", 0),
				"delta": map[string]any{"type": "input_json_delta", "partial_json": args},
			}))
		}

	case core.ChunkFinish:
		events = append(events, antCloseOpenBlock(state)...)
		// A second finish chunk (defensive: some upstreams repeat it) must not
		// emit a second message_delta.
		if !state.Bool("sent_delta") {
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
	state.Set("sent_delta", true)
	usage, _ := state.Get("usage").(core.Usage)
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
	return sseJSON("message_delta", payload)
}

// RenderStreamDone closes the stream: it guarantees message_start and
// message_delta were emitted and finishes with message_stop.
func (AnthropicCodec) RenderStreamDone(state *StreamState) [][]byte {
	if state == nil {
		return nil
	}
	var events [][]byte
	if !state.Bool("sent_start") {
		events = append(events, antRenderMessageStart(state))
	}
	events = append(events, antCloseOpenBlock(state)...)
	if !state.Bool("sent_delta") {
		events = append(events, antRenderMessageDelta(state, renderAntStop(core.FinishStop)))
	}
	events = append(events, sseJSON("message_stop", map[string]any{"type": "message_stop"}))
	return events
}
