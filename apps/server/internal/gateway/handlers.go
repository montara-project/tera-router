package gateway

import (
	"context"
	"errors"
	"net/http"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
	"tera-router/server/internal/transform"

	"github.com/gofiber/fiber/v3"
)

// requestMeta is the router-internal context attached to one inbound request.
// It is captured from the Fiber context up front because the Fiber context must
// not be touched after the handler returns (it is pooled and reused), which
// matters for the stream writer.
type requestMeta struct {
	KeyName  string
	APIKeyID string
	Client   string
	ClientIP string
	Dialect  core.Dialect
}

// metaFrom extracts the request metadata from the Fiber context and the
// authenticated key.
func metaFrom(c fiber.Ctx, key models.APIKey, dialect core.Dialect) requestMeta {
	return requestMeta{
		KeyName:  key.Name,
		APIKeyID: key.ID,
		Client:   detectClient(c),
		ClientIP: c.IP(),
		Dialect:  dialect,
	}
}

// coreMetadata builds the canonical RequestMetadata the codecs and connectors
// see.
func (m requestMeta) coreMetadata() core.RequestMetadata {
	return core.RequestMetadata{
		ClientKind:    m.Client,
		ClientIP:      m.ClientIP,
		SourceDialect: m.Dialect,
		APIKeyID:      m.APIKeyID,
	}
}

// handleOpenAIChat serves POST /v1/chat/completions.
func (s *Server) handleOpenAIChat(c fiber.Ctx) error {
	return s.handleChat(c, core.DialectOpenAI)
}

// handleAnthropicMessages serves POST /v1/messages.
func (s *Server) handleAnthropicMessages(c fiber.Ctx) error {
	return s.handleChat(c, core.DialectAnthropic)
}

// handleOpenAIResponses serves POST /v1/responses and POST /responses.
func (s *Server) handleOpenAIResponses(c fiber.Ctx) error {
	return s.handleChat(c, core.DialectOpenAIResponses)
}

// handleAnthropicCountTokens serves POST /v1/messages/count_tokens.
//
// Anthropic clients (notably Claude Code) call this before each turn to size
// the context window. It is answered locally: most OpenAI-dialect upstreams
// have no equivalent endpoint and would return 405. The estimate uses the
// common ~4 chars/token rule, which is accurate enough for client-side
// budgeting.
func (s *Server) handleAnthropicCountTokens(c fiber.Ctx) error {
	codec := s.codec(core.DialectAnthropic)
	if codec == nil {
		return s.fail(c, core.DialectAnthropic, http.StatusInternalServerError, "unsupported dialect")
	}

	body := c.Body()
	if len(body) == 0 {
		return s.fail(c, core.DialectAnthropic, http.StatusBadRequest, "failed to read request body")
	}

	req, err := codec.ParseRequest(body)
	if err != nil {
		return s.fail(c, core.DialectAnthropic, http.StatusBadRequest, "invalid request: "+err.Error())
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"input_tokens": estimateInputTokens(req)})
}

// handleChat is the shared chat entry point, parameterized by the dialect the
// client spoke.
func (s *Server) handleChat(c fiber.Ctx, dialect core.Dialect) error {
	release, ok := s.acquire()
	if !ok {
		return s.fail(c, dialect, http.StatusServiceUnavailable,
			"server is at capacity, please retry shortly")
	}

	key, ok := authedKey(c)
	if !ok {
		// Only reachable if the route was registered without authMiddleware.
		release()
		return s.fail(c, dialect, http.StatusUnauthorized, "missing API key")
	}
	meta := metaFrom(c, key, dialect)

	codec := s.codec(dialect)
	if codec == nil {
		release()
		return s.fail(c, dialect, http.StatusInternalServerError, "unsupported dialect")
	}

	body := c.Body()
	if len(body) == 0 {
		release()
		return s.fail(c, dialect, http.StatusBadRequest, "failed to read request body")
	}

	req, err := codec.ParseRequest(body)
	if err != nil {
		release()
		return s.fail(c, dialect, http.StatusBadRequest, "invalid request: "+err.Error())
	}

	// Fold a model-name reasoning suffix ("model(high)") into the canonical
	// reasoning config before routing, so neither the resolver nor the
	// upstream sees the literal suffix.
	applyModelSuffix(req)
	req.Metadata = meta.coreMetadata()

	// Routing, access control, and planning are bounded database work, so they
	// share a short deadline regardless of the request's streaming mode.
	routeCtx, routeCancel := context.WithTimeout(c.Context(), routingDeadline)
	resolved, err := s.resolveTargets(routeCtx, req.Model)
	if err != nil {
		routeCancel()
		release()
		var bad badModelError
		if errors.As(err, &bad) {
			s.log.Warn("gateway bad model", "model", req.Model, "key", meta.KeyName, "error", bad.Error())
			return s.fail(c, dialect, http.StatusBadRequest, bad.Error())
		}
		s.log.Error("gateway resolve targets failed", "model", req.Model, "error", err)
		return s.fail(c, dialect, http.StatusInternalServerError, "failed to resolve model")
	}

	// Strip reasoning suffixes carried by alias targets / chain steps.
	applyTargetSuffixes(req, resolved.Targets)

	plan, err := s.planForKey(routeCtx, key)
	if err != nil {
		routeCancel()
		release()
		s.log.Error("gateway load plan failed", "key", meta.KeyName, "error", err)
		return s.fail(c, dialect, http.StatusInternalServerError, "model access check failed")
	}

	if plan != nil && len(plan.AllowedModels) > 0 {
		filtered := filterAllowedTargets(key, resolved.Targets, resolved.ChainName, plan.AllowedModels)
		if len(filtered) == 0 {
			routeCancel()
			release()
			s.log.Warn("gateway model access denied",
				"key", meta.KeyName, "model", req.Model, "plan", plan.Name)
			return s.fail(c, dialect, http.StatusForbidden,
				"access denied: this API key is not permitted to use model "+req.Model)
		}
		resolved.Targets = filtered
	}

	if err := s.checkBudgets(routeCtx, key, plan); err != nil {
		routeCancel()
		release()
		pe := core.AsProviderError(err)
		if pe.Kind == core.ErrBudgetBlocked {
			s.log.Warn("gateway budget blocked", "key", meta.KeyName, "model", req.Model, "reason", pe.Message)
			return s.fail(c, dialect, statusForError(pe), pe.Message)
		}
		s.log.Error("gateway budget check failed", "key", meta.KeyName, "error", err)
		return s.fail(c, dialect, http.StatusInternalServerError, "budget check failed")
	}

	attempts := s.plan(routeCtx, resolved.Targets)
	routeCancel()
	if len(attempts) == 0 {
		release()
		s.log.Warn("gateway no attempts", "key", meta.KeyName, "model", req.Model, "targets", len(resolved.Targets))
		return s.fail(c, dialect, http.StatusServiceUnavailable,
			"no available account for model "+req.Model)
	}

	if req.Stream {
		// A streaming request outlives the handler: the stream writer runs
		// after it returns, so it gets a context of its own (canceled by the
		// writer) and keeps the in-flight slot until the last byte is written.
		streamCtx, streamCancel := context.WithTimeout(context.Background(), streamDeadline)
		return s.streamChat(c, streamCtx, streamCancel, release, codec, req, resolved, attempts, meta)
	}

	ctx, cancel := context.WithTimeout(c.Context(), unaryDeadline)
	defer cancel()
	defer release()
	return s.unaryChat(c, ctx, codec, req, resolved, attempts, meta)
}

// logCompletion emits the structured completion log line.
func (s *Server) logCompletion(meta requestMeta, provider, model string, tokens int, latency time.Duration, costMicros int64) {
	s.log.Info("gateway request completed",
		"key", meta.KeyName,
		"provider", provider,
		"model", model,
		"tokens", tokens,
		"cost_micros", costMicros,
		"latency_ms", latency.Milliseconds(),
		"client", meta.Client,
	)
}

// streamState builds the codec stream state for one stream, presetting the
// model name every chunk echoes.
func streamState(echoModel string) *transform.StreamState {
	return &transform.StreamState{Model: echoModel}
}
