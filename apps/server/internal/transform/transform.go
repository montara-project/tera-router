// Package transform converts between the three wire dialects the gateway
// speaks (OpenAI Chat Completions, Anthropic Messages, OpenAI Responses) and
// the canonical core types.
//
// A Codec parses an inbound request body into a core.ChatRequest, renders a
// canonical request back out for an upstream call, and converts upstream
// responses (unary and streaming) back into canonical form. The gateway pairs
// the client's codec with the chosen connector's codec, so any client dialect
// can be served by any upstream dialect through the canonical model.
package transform

import (
	"fmt"

	"tera-router/server/internal/core"
)

// Codec translates one dialect to and from the canonical model.
type Codec interface {
	// Dialect identifies the wire format this codec handles.
	Dialect() core.Dialect

	// ParseRequest decodes an inbound request body into canonical form.
	ParseRequest(body []byte) (*core.ChatRequest, error)

	// RenderRequest encodes a canonical request into this dialect's body for
	// an upstream call. providerID lets the renderer apply per-provider quirks.
	RenderRequest(req *core.ChatRequest, providerID string) ([]byte, error)

	// ParseResponse decodes a unary upstream response body into canonical form.
	ParseResponse(body []byte, model string) (*core.ChatResponse, error)

	// RenderResponse encodes a canonical response into this dialect's body for
	// returning to the client.
	RenderResponse(resp *core.ChatResponse) ([]byte, error)

	// ParseStreamEvent decodes one upstream SSE event (event name, possibly
	// empty, plus its joined data payload) into zero or more canonical
	// chunks. Returning (nil, nil) means "ignore this event".
	ParseStreamEvent(event string, data []byte, state *StreamState) ([]core.StreamChunk, error)

	// RenderStreamChunk encodes a canonical chunk into zero or more complete
	// SSE events (including "event:"/"data:" lines and the trailing blank
	// line) for the client.
	RenderStreamChunk(chunk core.StreamChunk, state *StreamState) ([][]byte, error)

	// RenderStreamDone returns the terminal bytes to flush when the stream
	// ends (e.g. OpenAI's "data: [DONE]"). May be empty.
	RenderStreamDone(state *StreamState) [][]byte
}

// StreamState carries per-stream bookkeeping across chunks (message ids,
// whether the opening event was sent, running block/tool indices, ...).
// Each direction of each stream gets its own zero-valued StreamState, with
// Model preset to the model name to echo.
type StreamState struct {
	MessageID string
	Model     string
	// Custom lets a codec stash dialect-specific bookkeeping.
	Custom map[string]any
}

// Registry resolves codecs by dialect.
type Registry struct {
	codecs map[core.Dialect]Codec
}

// NewRegistry builds a registry from the given codecs.
func NewRegistry(codecs ...Codec) *Registry {
	m := make(map[core.Dialect]Codec, len(codecs))
	for _, c := range codecs {
		m[c.Dialect()] = c
	}
	return &Registry{codecs: m}
}

// DefaultRegistry returns a registry with all built-in codecs registered.
func DefaultRegistry() *Registry {
	return NewRegistry(OpenAICodec{}, AnthropicCodec{}, OpenAIResponsesCodec{})
}

// Codec returns the codec for a dialect, or an error if none is registered.
func (r *Registry) Codec(d core.Dialect) (Codec, error) {
	c, ok := r.codecs[d]
	if !ok {
		return nil, fmt.Errorf("transform: no codec for dialect %q", d)
	}
	return c, nil
}
