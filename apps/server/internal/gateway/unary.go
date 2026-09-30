package gateway

import (
	"context"
	"net/http"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"

	"github.com/gofiber/fiber/v3"
)

// unaryChat runs a non-streaming request: it walks the attempt list until one
// succeeds, then renders the response in the client's dialect.
//
// Failures are handled in three tiers, mirroring the reference dispatcher:
//
//   - Non-fallbackable (bad request, context too large, suspended account):
//     the request itself is the problem, so the error surfaces immediately.
//   - Transient (upstream fault, timeout): retried on the same account with
//     exponential backoff, then the next target is tried.
//   - Everything else (auth, rate limit, quota): the account is parked and the
//     next target is tried.
func (s *Server) unaryChat(
	c fiber.Ctx,
	ctx context.Context,
	codec transform.Codec,
	req *core.ChatRequest,
	resolved resolveResult,
	attempts []attempt,
	meta requestMeta,
) error {
	start := time.Now()
	var lastErr *core.ProviderError

	for i := range attempts {
		at := attempts[i]
		if ctx.Err() != nil {
			return s.fail(c, meta.Dialect, statusForContextErr(ctx), "request canceled")
		}

		resp, pe, ok := s.callUnary(ctx, at, req, meta)
		if ok {
			return s.writeUnarySuccess(c, codec, req, resolved, at, resp, start, meta)
		}
		lastErr = pe

		// Feed the auto-combo engine's self-healing: a fallbackable failure
		// counts against the provider, a request-shaped one does not.
		if pe.Fallbackable() {
			s.combo.ExcludeAfterFailure(at.Target.Provider, at.Target.Model)
		}

		// A request-shaped failure will not improve on another account.
		if !pe.Fallbackable() {
			s.logFailure(pe)
			return s.fail(c, meta.Dialect, statusForError(pe), pe.Message)
		}
	}

	if lastErr == nil {
		return s.fail(c, meta.Dialect, http.StatusServiceUnavailable,
			"no available account for model "+req.Model)
	}
	s.logFailure(lastErr)
	return s.fail(c, meta.Dialect, statusForError(lastErr), lastErr.Message)
}

// callUnary performs one attempt, including same-account retries for transient
// faults. It returns the response on success, or the final provider error with
// ok=false.
func (s *Server) callUnary(ctx context.Context, at attempt, req *core.ChatRequest, meta requestMeta) (*core.ChatResponse, *core.ProviderError, bool) {
	for try := 0; ; try++ {
		// The request model is rewritten per attempt on a shallow clone: the
		// client's original request keeps the name it sent, which the response
		// echoes.
		attemptReq := cloneRequest(req, at.Target.Model)

		started := time.Now()
		resp, err := at.Conn.Chat(ctx, attemptReq, at.Creds)
		latency := time.Since(started)
		if err == nil {
			s.combo.NoteSuccess(at.Target.Provider, at.Target.Model)
			return resp, nil, true
		}

		pe := core.AsProviderError(err)
		if pe.AccountID == "" {
			pe.AccountID = at.AccountID
		}
		pe.Provider = at.Target.Provider
		pe.Model = at.Target.Model

		s.logFailure(pe)
		s.recordFailure(meta, at, pe, latency)
		s.noteFailure(pe)

		if !shouldRetrySameAccount(pe) || try >= sameAccountRetries {
			return nil, pe, false
		}
		backoff := retryBackoff(ctx, try)
		if backoff <= 0 {
			return nil, pe, false
		}
		s.log.Warn("gateway retrying same account",
			"provider", at.Target.Provider, "account", at.AccountID,
			"kind", string(pe.Kind), "retry", try+1, "backoff", backoff)
		if err := sleep(ctx, backoff); err != nil {
			return nil, core.AsProviderError(err), false
		}
	}
}

// writeUnarySuccess renders and writes a successful unary response.
func (s *Server) writeUnarySuccess(
	c fiber.Ctx,
	codec transform.Codec,
	req *core.ChatRequest,
	resolved resolveResult,
	at attempt,
	resp *core.ChatResponse,
	start time.Time,
	meta requestMeta,
) error {
	latency := time.Since(start)

	// Echo the name the client asked for (the alias when it resolved through
	// one) rather than the concrete upstream id.
	echo := resolved.EchoModel
	if echo == "" {
		echo = req.Model
	}
	if resp != nil {
		resp.Model = echo
	}

	out, err := codec.RenderResponse(resp)
	if err != nil {
		s.log.Error("gateway render response failed", "error", err, "model", echo)
		return s.fail(c, meta.Dialect, http.StatusInternalServerError, "failed to render response")
	}

	usage := core.Usage{}
	if resp != nil {
		usage = resp.Usage
	}
	rates := s.ratesFor(c.Context(), at.Target.Provider, at.Target.Model)
	cost := costMicros(rates, usage)
	s.recordUsage(usageRecord{
		APIKeyID:   meta.APIKeyID,
		AccountID:  at.AccountID,
		Provider:   at.Target.Provider,
		Model:      at.Target.Model,
		Client:     meta.Client,
		ClientIP:   meta.ClientIP,
		Usage:      usage,
		CostMicros: cost,
		Latency:    latency,
	})
	s.logCompletion(meta, at.Target.Provider, at.Target.Model,
		usage.PromptTokens+usage.CompletionTokens, latency, cost)

	c.Set("Content-Type", "application/json")
	c.Set("X-TeraRouter-Provider", at.Target.Provider)
	c.Set("X-TeraRouter-Model", echo)
	return c.Status(http.StatusOK).Send(out)
}

// cloneRequest returns a shallow copy of req with the model replaced. Slices
// and maps are shared: the attempt path never mutates them, and a deep copy of
// a large tool-laden conversation per attempt would be wasteful.
func cloneRequest(req *core.ChatRequest, model string) *core.ChatRequest {
	clone := *req
	clone.Model = model
	return &clone
}

// statusForContextErr maps a canceled/expired request context onto an HTTP
// status: a deadline is a gateway timeout, a cancellation is the client going
// away.
func statusForContextErr(ctx context.Context) int {
	if ctx.Err() == context.DeadlineExceeded {
		return http.StatusGatewayTimeout
	}
	return http.StatusBadRequest
}
