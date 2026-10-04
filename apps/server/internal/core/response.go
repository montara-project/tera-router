package core

// FinishReason explains why generation stopped.
type FinishReason string

const (
	FinishStop      FinishReason = "stop"
	FinishLength    FinishReason = "length"
	FinishToolCalls FinishReason = "tool_calls"
	FinishError     FinishReason = "error"
	FinishFilter    FinishReason = "content_filter"
)

// Usage reports token accounting for a completion.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	// CachedTokens counts prompt tokens served from a provider-side cache.
	CachedTokens int `json:"cached_tokens,omitempty"`
	// CacheWriteTokens counts prompt tokens written into a provider-side cache.
	CacheWriteTokens int `json:"cache_write_tokens,omitempty"`
	// ReasoningTokens counts tokens spent on extended thinking.
	ReasoningTokens int `json:"reasoning_tokens,omitempty"`
}

// Merge overlays the non-zero fields of a later usage event onto u. Upstreams
// split accounting across events (Anthropic reports input tokens at message
// start and output tokens at message end), so the last non-zero value for each
// field wins. TotalTokens is taken from next when it states one, otherwise
// recomputed from the merged prompt and completion counts.
func (u *Usage) Merge(next Usage) {
	if next.PromptTokens != 0 {
		u.PromptTokens = next.PromptTokens
	}
	if next.CompletionTokens != 0 {
		u.CompletionTokens = next.CompletionTokens
	}
	if next.CachedTokens != 0 {
		u.CachedTokens = next.CachedTokens
	}
	if next.CacheWriteTokens != 0 {
		u.CacheWriteTokens = next.CacheWriteTokens
	}
	if next.ReasoningTokens != 0 {
		u.ReasoningTokens = next.ReasoningTokens
	}
	if next.TotalTokens != 0 {
		u.TotalTokens = next.TotalTokens
	} else {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
}

// ChatResponse is the canonical non-streaming completion result.
type ChatResponse struct {
	ID           string       `json:"id"`
	Model        string       `json:"model"`
	Message      Message      `json:"message"`
	FinishReason FinishReason `json:"finish_reason"`
	Usage        Usage        `json:"usage"`
}

// ChunkType discriminates streaming events.
type ChunkType string

const (
	ChunkText     ChunkType = "text"      // incremental assistant text
	ChunkThinking ChunkType = "thinking"  // incremental reasoning text
	ChunkToolCall ChunkType = "tool_call" // (partial) tool invocation
	ChunkUsage    ChunkType = "usage"     // usage update (often final)
	ChunkFinish   ChunkType = "finish"    // terminal event with finish reason
	ChunkError    ChunkType = "error"     // mid-stream error
	ChunkPing     ChunkType = "ping"      // keep-alive / no-op
)

// StreamChunk is one provider-agnostic streaming event. The transform layer
// renders a sequence of these into the caller's SSE dialect.
type StreamChunk struct {
	Type ChunkType `json:"type"`

	// Delta carries incremental text for ChunkText / ChunkThinking.
	Delta string `json:"delta,omitempty"`

	// ToolCall carries a (possibly partial) tool invocation. Index identifies
	// which tool call this delta belongs to when multiple are streamed. The
	// first delta of a call carries ID and Name; later deltas carry only
	// argument fragments.
	ToolCall *ToolCall `json:"tool_call,omitempty"`
	Index    int       `json:"index,omitempty"`

	// Signature carries opaque reasoning-block data to echo back on later turns.
	Signature string `json:"signature,omitempty"`

	FinishReason FinishReason `json:"finish_reason,omitempty"`
	Usage        *Usage       `json:"usage,omitempty"`
	Err          error        `json:"-"`
}
