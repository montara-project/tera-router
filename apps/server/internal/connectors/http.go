// Package connectors implements provider drivers: the components that render a
// canonical request into a provider's wire format, perform the HTTP call, and
// parse the response (unary or streaming) back into canonical chunks.
//
// Connectors are thin and stateless. Format translation is delegated to the
// transform package; this package owns transport: endpoint construction, auth
// headers, streaming, and mapping HTTP/transport failures to structured
// core.ProviderErrors that drive the dispatcher's retry and fallback decisions.
package connectors

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/core"
)

const (
	// maxResponseBodyBytes caps a unary upstream response held in memory.
	maxResponseBodyBytes = 32 << 20 // 32 MiB
	// maxErrorBodyBytes caps the body read to classify a failed call.
	maxErrorBodyBytes = 64 << 10 // 64 KiB
	// streamBufferSize is the chunk channel buffer handed to callers. Large
	// enough that a fast upstream is not throttled by a momentarily busy
	// consumer, small enough to bound per-stream memory.
	streamBufferSize = 64
	// responseHeaderTimeout bounds how long an upstream may take to send
	// response headers. Reasoning models can take minutes to produce the first
	// token, but that happens after the headers, so this only catches a dead or
	// hanging origin. Total request time is governed by the caller's context.
	responseHeaderTimeout = 3 * time.Minute
)

// defaultTransportConfig returns the base transport shared by all upstream
// connections: many concurrent, long-lived streams to a handful of hosts.
func defaultTransportConfig() *http.Transport {
	return &http.Transport{
		MaxIdleConns:           200,
		MaxIdleConnsPerHost:    20,
		MaxConnsPerHost:        50,
		IdleConnTimeout:        120 * time.Second,
		TLSHandshakeTimeout:    10 * time.Second,
		ResponseHeaderTimeout:  responseHeaderTimeout,
		ExpectContinueTimeout:  1 * time.Second,
		WriteBufferSize:        16 * 1024,
		ReadBufferSize:         16 * 1024,
		ForceAttemptHTTP2:      true,
		MaxResponseHeaderBytes: 64 * 1024,
	}
}

// sharedClient is reused across connectors; its transport pools connections.
// It carries no Timeout: streaming responses are long-lived and the caller's
// context is the correct deadline.
var sharedClient = &http.Client{Transport: defaultTransportConfig()}

// proxyClientCache pools clients keyed by proxy URL so a per-account proxy does
// not allocate a fresh connection pool (and its goroutines) per request.
var proxyClientCache sync.Map // proxyURL -> *http.Client

// clientFor returns an HTTP client honouring creds.ProxyURL, falling back to
// the shared client when no proxy is configured.
func clientFor(creds core.Credentials) *http.Client {
	if creds.ProxyURL == "" {
		return sharedClient
	}
	if v, ok := proxyClientCache.Load(creds.ProxyURL); ok {
		return v.(*http.Client)
	}
	t := defaultTransportConfig()
	if u, err := url.Parse(creds.ProxyURL); err == nil {
		t.Proxy = http.ProxyURL(u)
		// Many HTTP proxies cannot speak HTTP/2 to the origin; skip the
		// upgrade attempt rather than paying for a failed negotiation.
		t.ForceAttemptHTTP2 = false
	}
	actual, _ := proxyClientCache.LoadOrStore(creds.ProxyURL, &http.Client{Transport: t})
	return actual.(*http.Client)
}

// unaryResponse is a buffered 2xx upstream response.
type unaryResponse struct {
	body        []byte
	contentType string
}

// newRequest builds a JSON POST with the connector's headers applied.
func newRequest(ctx context.Context, method, endpoint string, body []byte, headers map[string]string) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return req, nil
}

// doJSON performs a unary JSON POST, returning the buffered 2xx body. Transport
// failures and non-2xx statuses are classified into *core.ProviderError.
func doJSON(ctx context.Context, c call, endpoint string, body []byte, headers map[string]string) (*unaryResponse, error) {
	req, err := newRequest(ctx, http.MethodPost, endpoint, body, headers)
	if err != nil {
		return nil, c.internal(err)
	}
	resp, err := c.client().Do(req)
	if err != nil {
		return nil, c.transport(ctx, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errBody, _ := readCapped(resp.Body, maxErrorBodyBytes)
		return nil, c.status(resp, errBody)
	}

	respBody, err := readCapped(resp.Body, maxResponseBodyBytes)
	if err != nil {
		return nil, c.readError(ctx, err)
	}
	return &unaryResponse{
		body:        respBody,
		contentType: resp.Header.Get("Content-Type"),
	}, nil
}

// openStream performs a streaming POST and returns the 2xx response for the
// caller to consume. Non-2xx statuses are read (capped) and classified; the
// caller owns resp.Body.
func openStream(ctx context.Context, c call, endpoint string, body []byte, headers map[string]string) (*http.Response, error) {
	req, err := newRequest(ctx, http.MethodPost, endpoint, body, headers)
	if err != nil {
		return nil, c.internal(err)
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, c.transport(ctx, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		errBody, _ := readCapped(resp.Body, maxErrorBodyBytes)
		return nil, c.status(resp, errBody)
	}
	return resp, nil
}

// readCapped reads at most max bytes, discarding the rest.
func readCapped(r io.Reader, max int64) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, max))
}

// joinURL concatenates a base URL and path, collapsing duplicate slashes.
func joinURL(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

// bearer builds an Authorization: Bearer header value.
func bearer(token string) string { return "Bearer " + token }

// baseURL resolves the endpoint base: a per-account override wins over the
// catalog default.
func baseURL(defaultBase string, creds core.Credentials) string {
	if creds.BaseURL != "" {
		return creds.BaseURL
	}
	return defaultBase
}

// mergeHeaders combines connector-computed headers with the account's own.
// Account headers win, so an operator can always override a default.
func mergeHeaders(base, extra map[string]string) map[string]string {
	out := make(map[string]string, len(base)+len(extra))
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}
