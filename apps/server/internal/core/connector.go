package core

import (
	"context"
	"io"
	"net/http"
	"time"
)

// StreamConfig carries per-request stream instrumentation.
type StreamConfig struct {
	// OnFirstChunk, if non-nil, is called once when the first meaningful
	// chunk (text, thinking, or tool_call) arrives from the upstream, with
	// the elapsed time since the connection was opened (TTFT).
	OnFirstChunk func(elapsed time.Duration)
}

// Connector is the contract every provider driver implements. The pipeline
// selects a connector + credentials, hands it a canonical ChatRequest, and
// the connector renders its dialect, performs the HTTP call and parses the
// upstream response back into canonical form.
//
// Implementations must be safe for concurrent use.
type Connector interface {
	// ID returns the stable provider identifier (e.g. "openai").
	ID() string

	// Dialect reports the wire format this connector speaks upstream.
	Dialect() Dialect

	// Chat performs a non-streaming completion.
	Chat(ctx context.Context, req *ChatRequest, creds Credentials) (*ChatResponse, error)

	// Stream performs a streaming completion, emitting canonical chunks on the
	// returned channel until it is closed. A terminal error is delivered as a
	// ChunkError followed by channel close. Connect-time failures (non-2xx
	// status, transport errors) are returned as err before any chunk.
	Stream(ctx context.Context, req *ChatRequest, creds Credentials, cfg StreamConfig) (<-chan StreamChunk, error)
}

// DirectStreamable is optionally implemented by connectors that can return
// the raw upstream SSE body. The pipeline uses it for zero-copy same-dialect
// streaming: when the client dialect equals the upstream dialect the raw
// bytes are piped to the client without parse/re-serialize.
//
// Implementations return connect-time failures as err (same classification
// as Stream) and hand ownership of body to the caller.
type DirectStreamable interface {
	StreamRaw(ctx context.Context, req *ChatRequest, creds Credentials) (body io.ReadCloser, headers http.Header, err error)
}

// Credentials carries the resolved secret material a connector needs for a
// single upstream call. Connectors must never persist them.
type Credentials struct {
	// AccountID identifies which provider account these belong to.
	AccountID string
	// APIKey is set for key-based providers.
	APIKey string
	// AccessToken is set for OAuth/bearer providers.
	AccessToken string
	// BaseURL overrides the connector's default endpoint when non-empty.
	BaseURL string
	// Headers are extra headers to merge into the upstream request.
	Headers map[string]string
	// ProxyURL routes the upstream call through an HTTP/HTTPS/SOCKS proxy.
	ProxyURL string
}

// Token returns the bearer secret for the account: the API key when set,
// otherwise the OAuth access token.
func (c Credentials) Token() string {
	if c.APIKey != "" {
		return c.APIKey
	}
	return c.AccessToken
}
