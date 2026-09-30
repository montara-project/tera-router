package core

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ErrorKind classifies an upstream failure so the dispatcher can decide whether
// to retry the same account, fall back to the next account/model, or surface
// the error to the client immediately.
type ErrorKind string

const (
	// ErrAuth: credential rejected/expired. Try refresh, then next account.
	ErrAuth ErrorKind = "auth"
	// ErrRateLimit: quota/rate exceeded. Cool down this account, fall back.
	ErrRateLimit ErrorKind = "rate_limit"
	// ErrQuotaExhausted: subscription/budget fully consumed. Fall back.
	ErrQuotaExhausted ErrorKind = "quota_exhausted"
	// ErrAccountSuspended: upstream rejected with HTTP 402 (or 403 billing).
	// The account cannot be used — no quota, insufficient balance, plan expired,
	// or suspended. Do NOT retry; disable the account until the owner resolves it.
	ErrAccountSuspended ErrorKind = "account_suspended"
	// ErrUpstream: 5xx / transient upstream fault. Retry then fall back.
	ErrUpstream ErrorKind = "upstream"
	// ErrUpstreamBlocked: the upstream edge (WAF/CDN) rejected the request
	// with an HTML 403, not the model API. Affects all keys on the provider.
	ErrUpstreamBlocked ErrorKind = "upstream_blocked"
	// ErrTimeout: stream stalled or request timed out. Retry then fall back.
	ErrTimeout ErrorKind = "timeout"
	// ErrBadRequest: 4xx caused by the request itself. Do NOT fall back; surface.
	ErrBadRequest ErrorKind = "bad_request"
	// ErrContextTooLarge: upstream rejected the request because the message
	// exceeds the model's context window. Do NOT fall back — the prompt is
	// the problem, not the account — but surface a typed error so the
	// caller can distinguish it from a generic bad request (e.g. the portal
	// can show "conversation too long" instead of "invalid request").
	ErrContextTooLarge ErrorKind = "context_too_large"
	// ErrCapability: chosen model lacks a required capability. Skip, no surface.
	ErrCapability ErrorKind = "capability"
	// ErrBudgetBlocked: IDRouter budget guard rejected before dispatch.
	ErrBudgetBlocked ErrorKind = "budget_blocked"
	// ErrInternal: router-internal fault.
	ErrInternal ErrorKind = "internal"
	// ErrToolCallMalformed: upstream rejected with HTTP 400 due to a malformed
	// tool call (e.g. missing function name from a truncated stream). The
	// request can often be salvaged by stripping the broken tool call and
	// retrying. Fallbackable – the dispatcher should try the next target with
	// a cleaned prompt. Not retryable on the same account because the request
	// body itself needs repair first.
	ErrToolCallMalformed ErrorKind = "tool_call_malformed"
	// ErrBilling: billing/payment issue. Account needs attention.
	ErrBilling ErrorKind = "billing"
	// ErrCapacity: upstream at capacity. Retry with backoff.
	ErrCapacity ErrorKind = "capacity"
	// ErrModelNotFound: requested model doesn't exist.
	ErrModelNotFound ErrorKind = "model_not_found"
	ErrLoopDetected  ErrorKind = "loop_detected"
	ErrEmptyResponse ErrorKind = "empty_response"
	// ErrEmptyStream marks an upstream that closed the stream before any
	// content chunk arrived. Usually a network/proxy artifact or an upstream
	// hangup, not a broken credential -- kept distinct from ErrEmptyResponse so
	// the dashboard shows the real cause and its escalation threshold stays
	// tunable separately.
	ErrEmptyStream ErrorKind = "empty_stream"
)

// ProviderError is the structured error connectors and the pipeline return. It
// carries enough context for the dispatcher to make a fallback decision and for
// the gateway to render an accurate HTTP status to the client.
type ProviderError struct {
	Kind ErrorKind
	// Provider and Model identify where the failure originated.
	Provider string
	Model    string
	// AccountID identifies the specific account that failed, so the gateway
	// can run provider-specific health checks (e.g. auto-disable suspended
	// Kiro accounts) and update account-level bookkeeping.
	AccountID string
	// StatusCode is the upstream HTTP status, if any.
	StatusCode int
	// Message is a human-readable summary safe to log.
	Message string
	// RetryAfter, when non-zero, is the upstream-suggested retry delay.
	RetryAfter time.Duration
	// Cause is the wrapped underlying error.
	Cause error
	// QuotaScope indicates whether the quota exhaustion is per-model or
	// per-account. "" = unknown (default), "model" = only this model on
	// the account is exhausted (other models still usable), "account" =
	// the entire account is unusable (no models work). The dispatcher
	// uses this to choose the cooldown scope: model cooldown for
	// per-model exhaustion, account cooldown for per-account.
	QuotaScope string
}

func (e *ProviderError) Error() string {
	if e.Provider != "" {
		return fmt.Sprintf("%s: %s (provider=%s model=%s status=%d)",
			e.Kind, e.Message, e.Provider, e.Model, e.StatusCode)
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func (e *ProviderError) Unwrap() error { return e.Cause }

// Retryable reports whether trying the same model again (possibly on another
// account) could succeed.
func (e *ProviderError) Retryable() bool {
	switch e.Kind {
	case ErrUpstream, ErrTimeout, ErrRateLimit, ErrEmptyResponse, ErrEmptyStream:
		return true
	default:
		return false
	}
}

// Fallbackable reports whether the dispatcher should advance to the next
// candidate in the chain rather than surfacing this error to the client.
func (e *ProviderError) Fallbackable() bool {
	switch e.Kind {
	case ErrBadRequest:
		return false
	case ErrContextTooLarge, ErrBudgetBlocked, ErrAccountSuspended:
		return false
	default:
		return true
	}
}
func AsProviderError(err error) *ProviderError {
	if err == nil {
		return nil
	}
	var pe *ProviderError
	if errors.As(err, &pe) {
		return pe
	}
	// Classify context errors properly so the pipeline applies backoff
	// instead of falling back instantly (which causes CPU spikes).
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return &ProviderError{Kind: ErrTimeout, Message: err.Error(), Cause: err}
	}
	return &ProviderError{Kind: ErrInternal, Message: err.Error(), Cause: err}
}

// NewProviderError constructs a ProviderError with the given kind and message.
func NewProviderError(kind ErrorKind, msg string) *ProviderError {
	return &ProviderError{Kind: kind, Message: msg}
}
