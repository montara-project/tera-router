package connectors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"tera-router/server/internal/core"
)

// errorMessageLimit caps the upstream text echoed into a ProviderError message.
const errorMessageLimit = 500

// maxBodyRateLimitCooldown caps a retry window derived from a response body.
// Providers sometimes report a multi-hour reset (a daily quota); honouring it
// verbatim would strand the account, so it is clamped.
const maxBodyRateLimitCooldown = 30 * time.Minute

// call identifies one upstream attempt. It exists so every failure site can
// build a fully-populated *core.ProviderError without repeating the provider,
// model and account identifiers.
type call struct {
	provider  string
	model     string
	accountID string
	creds     core.Credentials
}

// client returns the HTTP client for this attempt (proxy-aware).
func (c call) client() *http.Client { return clientFor(c.creds) }

// internal wraps a local (pre-flight) failure, e.g. a request that cannot even
// be constructed or a request body that fails to render.
func (c call) internal(err error) *core.ProviderError {
	return &core.ProviderError{
		Kind:      core.ErrInternal,
		Provider:  c.provider,
		Model:     c.model,
		AccountID: c.accountID,
		Message:   err.Error(),
		Cause:     err,
	}
}

// transport classifies a transport-level failure (DNS, dial, TLS, context).
func (c call) transport(ctx context.Context, err error) *core.ProviderError {
	kind := core.ErrUpstream
	switch {
	case errors.Is(err, context.DeadlineExceeded), errors.Is(ctx.Err(), context.DeadlineExceeded):
		kind = core.ErrTimeout
	case errors.Is(err, context.Canceled):
		// A client that hung up is not an upstream fault, but the dispatcher
		// treats it as a terminal timeout rather than retrying other accounts.
		kind = core.ErrTimeout
	case isTimeout(err):
		kind = core.ErrTimeout
	}
	return &core.ProviderError{
		Kind:      kind,
		Provider:  c.provider,
		Model:     c.model,
		AccountID: c.accountID,
		Message:   err.Error(),
		Cause:     err,
	}
}

// readError classifies a failure while reading an upstream body. A read killed
// by the caller's context is classified exactly like a transport failure.
func (c call) readError(ctx context.Context, err error) *core.ProviderError {
	pe := c.transport(ctx, err)
	pe.Message = "read body: " + err.Error()
	return pe
}

// isTimeout reports whether err is a network timeout.
func isTimeout(err error) bool {
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return true
	}
	return errors.Is(err, os.ErrDeadlineExceeded)
}

// status maps an HTTP error response to a classified ProviderError. The kind
// derives from the status code, then body content may promote it to a more
// specific kind (context-too-large, model-not-found, quota, ...).
func (c call) status(resp *http.Response, body []byte) *core.ProviderError {
	kind := classifyStatus(resp.StatusCode, body)

	pe := &core.ProviderError{
		Kind:       kind,
		Provider:   c.provider,
		Model:      c.model,
		AccountID:  c.accountID,
		StatusCode: resp.StatusCode,
		Message:    statusMessage(resp.StatusCode, kind, body),
	}
	if d := parseRetryAfter(resp.Header, body, kind); d > 0 {
		pe.RetryAfter = d
	}
	return pe
}

// classifyStatus derives the error kind from the HTTP status code, then lets
// the response body override it when the body is more specific than the code
// (providers routinely return 400/401/500 for quota and context errors).
func classifyStatus(statusCode int, body []byte) core.ErrorKind {
	var kind core.ErrorKind
	switch {
	case statusCode == 402:
		kind = core.ErrAccountSuspended
	case statusCode == 408, statusCode == 504, statusCode == 524:
		// 524 is Cloudflare's origin timeout.
		kind = core.ErrTimeout
	case statusCode == 401:
		kind = core.ErrAuth
	case statusCode == 403:
		if isHTMLBody(body) {
			// A WAF/CDN block page, not the model API: every key on the
			// provider is affected.
			kind = core.ErrUpstreamBlocked
		} else {
			kind = core.ErrAuth
		}
	case statusCode == 429:
		kind = core.ErrRateLimit
	case statusCode >= 500:
		kind = core.ErrUpstream
	case statusCode >= 400:
		kind = core.ErrBadRequest
	default:
		kind = core.ErrUpstream
	}

	// Promote from the body. Each promotion is more specific than the code.
	switch {
	case kind == core.ErrBadRequest && isContextTooLarge(statusCode, body):
		kind = core.ErrContextTooLarge
	case kind == core.ErrBadRequest && isModelNotFound(statusCode, body):
		kind = core.ErrModelNotFound
	case kind == core.ErrBadRequest && isToolCallMalformed(statusCode, body):
		kind = core.ErrToolCallMalformed
	case kind == core.ErrUpstream && isEmptyContentRejection(statusCode, body):
		// Some gateways wrap an inner 400 ("user message must have content")
		// in a 500 envelope. The request is at fault, so retrying other
		// accounts only spams the upstream.
		kind = core.ErrBadRequest
	}

	// Quota/billing/suspension signals override a misleading status (e.g. a
	// 401 carrying "insufficient balance" is not an expired credential).
	if k := bodyKindOverride(kind, body); k != "" {
		kind = k
	}
	return kind
}

// isHTMLBody reports whether a body looks like an HTML page (a WAF block page
// rather than a JSON API error).
func isHTMLBody(body []byte) bool {
	for _, b := range body {
		switch b {
		case ' ', '\t', '\n', '\r':
			continue
		case '<':
			return true
		default:
			return false
		}
	}
	return false
}

// needles are matched case-insensitively against the raw error body.
var (
	contextTooLargeNeedles = []string{
		"context_length_exceeded",
		"context_too_large",
		"context length",
		"maximum context",
		"too many tokens",
		"reduce the length",
	}
	modelNotFoundNeedles = []string{
		"model_not_available",
		"model_not_found",
		"model is not available",
		"model does not exist",
		"unknown model",
		"model not found",
		"invalid model",
	}
	toolCallMalformedNeedles = []string{
		"missing a function name",
		"missing function name",
		"tool_calls",
		"tool call",
		"tool_call",
		"function name",
		"invalid tool",
		"tool call validation",
		"function.required",
	}
	accountSuspendedNeedles = []string{
		"account suspended",
		"account has been suspended",
		"is suspended",
		"insufficient balance",
		"balance is insufficient",
		"no balance",
		"plan expired",
		"plan has expired",
		"subscription expired",
		"subscription has expired",
		"payment required",
		"not subscribed",
		"no active subscription",
	}
	rateLimitNeedles = []string{
		"rate limit",
		"rate_limit",
		"rate-limited",
		"too many requests",
		"request limit",
		"request_limit",
		"throttl",
	}
	quotaExhaustedNeedles = []string{
		"quota exhausted",
		"quota_exhausted",
		"quota has been exhausted",
		"insufficient_quota",
		"exceeded your current quota",
	}
	creditExhaustedNeedles = []string{
		"credits have been exhausted",
		"credit exhausted",
		"insufficient balance",
		"quota exhausted",
		"out of credits",
		"no credits",
	}
)

func containsAny(low string, needles []string) bool {
	for _, n := range needles {
		if strings.Contains(low, n) {
			return true
		}
	}
	return false
}

func isContextTooLarge(statusCode int, body []byte) bool {
	if statusCode < 400 || statusCode >= 500 || len(body) == 0 {
		return false
	}
	return containsAny(strings.ToLower(string(body)), contextTooLargeNeedles)
}

func isModelNotFound(statusCode int, body []byte) bool {
	if statusCode < 400 || statusCode >= 500 || len(body) == 0 {
		return false
	}
	return containsAny(strings.ToLower(string(body)), modelNotFoundNeedles)
}

func isToolCallMalformed(statusCode int, body []byte) bool {
	if statusCode < 400 || statusCode >= 500 || len(body) == 0 {
		return false
	}
	return containsAny(strings.ToLower(string(body)), toolCallMalformedNeedles)
}

// isEmptyContentRejection reports whether an upstream error body signals that a
// message carried empty content (e.g. Vercel's "user message must have
// content"), including the 500 envelope that wraps the inner 400.
func isEmptyContentRejection(statusCode int, body []byte) bool {
	if statusCode < 400 || statusCode >= 600 || len(body) == 0 {
		return false
	}
	low := strings.ToLower(string(body))
	if !strings.Contains(low, "must have content") {
		return false
	}
	for _, needle := range []string{"messages.", ".content", "invalid_request_error", "user message"} {
		if strings.Contains(low, needle) {
			return true
		}
	}
	return false
}

// isCreditExhausted reports whether a 2xx body actually signals that the
// account is out of credits. Some providers answer 200 with a human-readable
// "credits exhausted" body instead of an error status.
func isCreditExhausted(body []byte) bool {
	if len(body) == 0 {
		return false
	}
	return containsAny(strings.ToLower(string(body)), creditExhaustedNeedles)
}

// bodyKindOverride returns a more specific kind when the body reveals one, or
// "" to keep the status-derived kind. It only applies to the generic kinds: a
// kind already derived from the body (context-too-large, model-not-found) or
// from a distinctive status (a WAF block page, an explicit 402) must not be
// second-guessed by a substring scan.
func bodyKindOverride(kind core.ErrorKind, body []byte) core.ErrorKind {
	if len(body) == 0 {
		return ""
	}
	switch kind {
	case core.ErrAuth, core.ErrBadRequest, core.ErrUpstream, core.ErrRateLimit:
	default:
		return ""
	}

	low := strings.ToLower(string(body))
	switch {
	case containsAny(low, quotaExhaustedNeedles):
		// A quota body is a rate-limit signal even when the status says 400/401.
		return core.ErrQuotaExhausted
	case containsAny(low, accountSuspendedNeedles):
		return core.ErrAccountSuspended
	case containsAny(low, rateLimitNeedles):
		return core.ErrRateLimit
	}
	return ""
}

// parseRetryAfter resolves the retry delay advertised by an upstream error:
// the Retry-After header (seconds or HTTP-date) or a body-encoded reset
// window.
func parseRetryAfter(h http.Header, body []byte, kind core.ErrorKind) time.Duration {
	if h != nil {
		if v := strings.TrimSpace(h.Get("Retry-After")); v != "" {
			if secs, err := strconv.Atoi(v); err == nil && secs >= 0 {
				return time.Duration(secs) * time.Second
			}
			if t, err := http.ParseTime(v); err == nil {
				if d := time.Until(t); d > 0 {
					return d
				}
			}
		}
		// Some gateways express the delay in milliseconds instead.
		if v := strings.TrimSpace(h.Get("retry-after-ms")); v != "" {
			if ms, err := strconv.Atoi(v); err == nil && ms >= 0 {
				return time.Duration(ms) * time.Millisecond
			}
		}
	}
	if kind == core.ErrRateLimit || kind == core.ErrQuotaExhausted {
		if d := parseBodyResetWindow(body); d > 0 {
			return min(d, maxBodyRateLimitCooldown)
		}
	}
	return 0
}

// parseBodyResetWindow extracts a reset duration from a JSON error body using
// the field names providers commonly emit (relative seconds/milliseconds or an
// absolute epoch). Returns 0 when nothing usable is present.
func parseBodyResetWindow(body []byte) time.Duration {
	if len(body) == 0 {
		return 0
	}
	var top map[string]any
	if err := json.Unmarshal(body, &top); err != nil {
		return 0
	}
	search := []map[string]any{top}
	if e, ok := top["error"].(map[string]any); ok {
		search = append(search, e)
	}

	now := time.Now()
	for _, obj := range search {
		for _, k := range []string{"retry_after", "retryAfter", "retry_after_seconds"} {
			if v, ok := numField(obj, k); ok && v > 0 {
				return time.Duration(v) * time.Second
			}
		}
		for _, k := range []string{"resetsAtMs", "reset_at_ms", "resetAtMs"} {
			if v, ok := numField(obj, k); ok && v > 0 {
				ms := int64(v)
				nowMs := now.UnixMilli()
				switch {
				case ms > nowMs: // absolute epoch in the future
					return time.Duration(ms-nowMs) * time.Millisecond
				case ms < int64((24 * time.Hour).Milliseconds()): // plausibly relative
					return time.Duration(ms) * time.Millisecond
				}
			}
		}
		for _, k := range []string{"resetAt", "reset_at", "resets_at"} {
			if v, ok := numField(obj, k); ok && v > 0 {
				sec := int64(v)
				if sec > now.Unix() {
					return time.Duration(sec-now.Unix()) * time.Second
				}
			}
		}
	}
	return 0
}

// numField reads a numeric field encoded as a JSON number or numeric string.
func numField(obj map[string]any, key string) (float64, bool) {
	v, ok := obj[key]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return n, true
	case json.Number:
		if f, err := n.Float64(); err == nil {
			return f, true
		}
	case string:
		if f, err := strconv.ParseFloat(strings.TrimSpace(n), 64); err == nil {
			return f, true
		}
	}
	return 0, false
}

// statusMessage builds the human-readable error message: the upstream text
// when present, otherwise a description of the status.
func statusMessage(statusCode int, kind core.ErrorKind, body []byte) string {
	if statusCode == 524 && strings.TrimSpace(string(body)) == "" {
		return "origin timeout (Cloudflare 524): upstream did not respond in time"
	}
	if msg := extractErrorMessage(body); msg != "" {
		return msg
	}
	return fmt.Sprintf("upstream returned %d %s (kind=%s)", statusCode, http.StatusText(statusCode), kind)
}

// extractErrorMessage pulls a human-readable message out of an upstream error
// body, handling the JSON shapes providers actually emit:
//
//	{"error": {"message": "...", "type": "...", "code": "..."}}
//	{"message": "..."}
//	{"error": "..."}
//
// Non-JSON bodies are used verbatim. The result is truncated.
func extractErrorMessage(body []byte) string {
	s := strings.TrimSpace(string(body))
	if s == "" {
		return "upstream returned an error with empty body"
	}
	if !strings.HasPrefix(s, "{") {
		return truncateMessage(s)
	}
	var payload struct {
		Error   json.RawMessage `json:"error"`
		Message string          `json:"message"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return truncateMessage(s)
	}
	if len(payload.Error) > 0 {
		var nested struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    string `json:"code"`
		}
		if err := json.Unmarshal(payload.Error, &nested); err == nil {
			if nested.Message != "" {
				return truncateMessage(nested.Message)
			}
			if nested.Type != "" {
				return truncateMessage(nested.Type)
			}
			if nested.Code != "" {
				return truncateMessage(nested.Code)
			}
		}
		var asString string
		if err := json.Unmarshal(payload.Error, &asString); err == nil && asString != "" {
			return truncateMessage(asString)
		}
	}
	if payload.Message != "" {
		return truncateMessage(payload.Message)
	}
	return truncateMessage(s)
}

// truncateMessage bounds an upstream message so it stays log-safe.
func truncateMessage(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > errorMessageLimit {
		return s[:errorMessageLimit] + "..."
	}
	return s
}
