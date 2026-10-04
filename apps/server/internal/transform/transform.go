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
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

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

// The accessors below are nil-receiver safe so a codec can call them on a
// StreamState it did not allocate.

// Get returns a Custom value, or nil when the state or key is absent.
func (s *StreamState) Get(key string) any {
	if s == nil || s.Custom == nil {
		return nil
	}
	return s.Custom[key]
}

// Set stores a Custom value, initializing the map on first use.
func (s *StreamState) Set(key string, val any) {
	if s == nil {
		return
	}
	if s.Custom == nil {
		s.Custom = map[string]any{}
	}
	s.Custom[key] = val
}

// Int reads an int Custom value, returning def when absent or of another type.
func (s *StreamState) Int(key string, def int) int {
	if v, ok := s.Get(key).(int); ok {
		return v
	}
	return def
}

// Bool reads a bool Custom value (false when absent).
func (s *StreamState) Bool(key string) bool {
	v, _ := s.Get(key).(bool)
	return v
}

// String reads a string Custom value ("" when absent).
func (s *StreamState) String(key string) string {
	v, _ := s.Get(key).(string)
	return v
}

// stateModel returns the model name a codec echoes, or "" for a nil state.
func stateModel(s *StreamState) string {
	if s == nil {
		return ""
	}
	return s.Model
}

// randomID mints an id with the given prefix (chatcmpl-, msg_, resp_, call_, ...).
func randomID(prefix string) string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + strings.Repeat("0", 24)
	}
	return prefix + hex.EncodeToString(b[:])
}

// parseImageURL decomposes an image URL into a MediaPayload: data URIs are
// split into MIMEType + base64 data, everything else stays a remote URL.
func parseImageURL(rawURL string) *core.MediaPayload {
	if rest, ok := strings.CutPrefix(rawURL, "data:"); ok {
		if i := strings.Index(rest, ";base64,"); i > 0 {
			return &core.MediaPayload{MIMEType: rest[:i], Data: rest[i+len(";base64,"):]}
		}
	}
	return &core.MediaPayload{URL: rawURL}
}

// mediaURL renders a MediaPayload as a URL: inline base64 becomes a data URI,
// a remote URL is returned as-is.
func mediaURL(m *core.MediaPayload) string {
	if m.Data != "" {
		mime := m.MIMEType
		if mime == "" {
			mime = "image/png"
		}
		return "data:" + mime + ";base64," + m.Data
	}
	return m.URL
}

// Registry resolves codecs by dialect.
type Registry struct {
	codecs map[core.Dialect]Codec
}

// DefaultRegistry returns a registry with all built-in codecs registered.
func DefaultRegistry() *Registry {
	codecs := []Codec{OpenAICodec{}, AnthropicCodec{}, OpenAIResponsesCodec{}}
	m := make(map[core.Dialect]Codec, len(codecs))
	for _, c := range codecs {
		m[c.Dialect()] = c
	}
	return &Registry{codecs: m}
}

// Codec returns the codec for a dialect, or an error if none is registered.
func (r *Registry) Codec(d core.Dialect) (Codec, error) {
	c, ok := r.codecs[d]
	if !ok {
		return nil, fmt.Errorf("transform: no codec for dialect %q", d)
	}
	return c, nil
}
