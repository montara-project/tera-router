package gateway

import (
	"net/http"
	"strings"

	"tera-router/server/internal/core"

	"github.com/gofiber/fiber/v3"
)

// Error bodies.
//
// Inference traffic is consumed by SDKs, not the dashboard, so the gateway
// renders OpenAI's error envelope ({"error":{"message","type"}}) rather than
// the dashboard's {"message": ...}. Anthropic-native callers get Anthropic's
// shape ({"type":"error","error":{"type","message"}}) — same status, same
// message, different envelope.

// writeError renders an OpenAI-style error envelope.
func writeError(c fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"error": fiber.Map{
			"message": message,
			"type":    errorType(status),
		},
	})
}

// writeAnthropicError renders an Anthropic-style error envelope.
func writeAnthropicError(c fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"type": "error",
		"error": fiber.Map{
			"type":    anthropicErrorType(status),
			"message": message,
		},
	})
}

// errorType maps an HTTP status onto the OpenAI error type vocabulary.
func errorType(status int) string {
	switch {
	case status == http.StatusUnauthorized:
		return "authentication_error"
	case status == http.StatusTooManyRequests:
		return "rate_limit_error"
	case status >= 400 && status < 500:
		return "invalid_request_error"
	default:
		return "api_error"
	}
}

// anthropicErrorType maps an HTTP status onto Anthropic's error type
// vocabulary.
func anthropicErrorType(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "invalid_request_error"
	case http.StatusUnauthorized:
		return "authentication_error"
	case http.StatusForbidden:
		return "permission_error"
	case http.StatusNotFound:
		return "not_found_error"
	case http.StatusTooManyRequests:
		return "rate_limit_error"
	case http.StatusRequestEntityTooLarge:
		return "request_too_large"
	default:
		return "api_error"
	}
}

// fail renders an error in the dialect the caller spoke.
func (s *Server) fail(c fiber.Ctx, dialect core.Dialect, status int, message string) error {
	if dialect == core.DialectAnthropic {
		return writeAnthropicError(c, status, message)
	}
	return writeError(c, status, message)
}

// statusForError maps a canonical provider error onto the HTTP status the
// client should see.
func statusForError(pe *core.ProviderError) int {
	switch pe.Kind {
	case core.ErrBadRequest, core.ErrContextTooLarge, core.ErrModelNotFound, core.ErrToolCallMalformed:
		return http.StatusBadRequest
	case core.ErrAuth:
		return http.StatusUnauthorized
	case core.ErrRateLimit, core.ErrCapacity:
		return http.StatusTooManyRequests
	case core.ErrQuotaExhausted, core.ErrBudgetBlocked, core.ErrAccountSuspended, core.ErrBilling:
		return http.StatusPaymentRequired
	case core.ErrTimeout:
		return http.StatusGatewayTimeout
	case core.ErrInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusBadGateway
	}
}

// maxErrorMessageLen caps the persisted error_message column; a multi-KB
// upstream stack is noise in the dashboard tooltip.
const maxErrorMessageLen = 200

// sanitizeErrorMessage strips credential-looking fragments and caps length
// before an upstream message is persisted or logged.
func sanitizeErrorMessage(msg string) string {
	if msg == "" {
		return ""
	}
	msg = redactSkKey(msg)
	msg = redactBearerToken(msg)
	if len(msg) > maxErrorMessageLen {
		msg = msg[:maxErrorMessageLen] + "…"
	}
	return msg
}

// redactSkKey replaces an `sk-`-prefixed key (≥20 token characters) with a
// marker that keeps the provider-identifying prefix.
func redactSkKey(msg string) string {
	var b strings.Builder
	for i := 0; i < len(msg); {
		if strings.HasPrefix(msg[i:], "sk-") && i+3 < len(msg) {
			j := i
			for j < len(msg) && isTokenChar(msg[j]) {
				j++
			}
			if j-i >= 20 {
				b.WriteString(msg[i : i+min(8, j-i)])
				b.WriteString("…[redacted]")
				i = j
				continue
			}
		}
		b.WriteByte(msg[i])
		i++
	}
	return b.String()
}

// redactBearerToken replaces a `Bearer <token>` value with a marker.
func redactBearerToken(msg string) string {
	const marker = "Bearer "
	var b strings.Builder
	for i := 0; i < len(msg); {
		if strings.HasPrefix(msg[i:], marker) {
			j := i + len(marker)
			for j < len(msg) && isTokenChar(msg[j]) {
				j++
			}
			if j-(i+len(marker)) >= 20 {
				b.WriteString(marker)
				b.WriteString("[redacted]")
				i = j
				continue
			}
		}
		b.WriteByte(msg[i])
		i++
	}
	return b.String()
}

func isTokenChar(c byte) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		return true
	case c == '-', c == '_', c == '.', c == '~', c == '+', c == '/', c == '=':
		return true
	default:
		return false
	}
}

// logFailure records a failed attempt at Warn level with the sanitized
// upstream detail.
func (s *Server) logFailure(pe *core.ProviderError) {
	if s.log == nil {
		return
	}
	s.log.Warn("gateway attempt failed",
		"provider", pe.Provider,
		"model", pe.Model,
		"account", pe.AccountID,
		"kind", string(pe.Kind),
		"status", pe.StatusCode,
		"error", sanitizeErrorMessage(pe.Message),
	)
}
