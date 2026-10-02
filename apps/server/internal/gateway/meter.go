package gateway

import (
	"context"
	"errors"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/cost"
	"tera-router/server/internal/lib/modelprices"
	"tera-router/server/internal/models"
)

// Cost accounting.
//
// Pricing overrides are stored as micros of USD per million tokens, so a rate
// of 2_500_000 means $2.50 per million tokens. Cost is accumulated in micros
// (millionths of a dollar) as an integer to avoid floating-point drift in
// budget accounting. A model with neither an override nor a compiled-in retail
// rate costs zero, which is the correct default for self-hosted and free-tier
// endpoints.

// costMicros computes the cost of a usage event in micros of USD through the
// shared cost package, so the gateway's charge and the usage dashboard's
// re-derived figures cannot drift apart.
func costMicros(rates cost.Rates, u core.Usage) int64 {
	return cost.Micros(rates,
		int64(u.PromptTokens), int64(u.CachedTokens), int64(u.CacheWriteTokens),
		int64(u.CompletionTokens), int64(u.ReasoningTokens))
}

// pricingFor resolves the pricing verdict for a provider/model pair: the cost
// rates and the token-budget drain multiplier. Operator overrides win (per-
// model, then the provider-level row with an empty model); the compiled-in
// retail table backs known models so usage shows a real cost without manual
// setup. A miss yields zero rates, not an error: an unpriced model is free.
//
// Only overrides carry a token rate — the retail table always drains 1:1. A
// nil rate means "no override"; an override's explicit 0 means the model
// drains no token budget at all.
func (s *Server) pricingFor(ctx context.Context, provider, model string) (cost.Rates, *float64) {
	override, err := s.app.Repos.Pricing.Get(ctx, provider, model)
	if err != nil {
		if !isNotFound(err) {
			s.log.Warn("gateway pricing lookup failed", "provider", provider, "model", model, "error", err)
		}
		override, err = s.app.Repos.Pricing.Get(ctx, provider, "")
	}
	if err != nil {
		if !isNotFound(err) {
			s.log.Warn("gateway provider pricing lookup failed", "provider", provider, "error", err)
		}
		if rates, ok := modelprices.Lookup(provider, model); ok {
			return rates, nil
		}
		return cost.Rates{}, nil
	}
	rates := cost.Rates{
		InputMicros:      override.InputMicros,
		OutputMicros:     override.OutputMicros,
		CacheReadMicros:  override.CacheReadMicros,
		CacheWriteMicros: override.CacheWriteMicros,
		ReasoningMicros:  override.ReasoningMicros,
	}
	return rates, override.TokenConsumptionRate
}

// isNotFound reports whether an error is the repositories' typed not-found.
func isNotFound(err error) bool {
	return errors.Is(err, apperr.ErrNotFound)
}

// usageRecord is the gateway's per-request metering event.
type usageRecord struct {
	APIKeyID string
	// AccountID is empty for synthetic (account-less) attempts.
	AccountID string
	Provider  string
	Model     string
	Client    string
	ClientIP  string
	// RequestID and Chain attribute the row to one client request and the
	// routing chain that served it (see provider health aggregation).
	RequestID string
	Chain     string

	Usage core.Usage
	// CostMicros is computed by the caller from the resolved rates.
	CostMicros int64
	// TokenRate snapshots the model's budget-drain multiplier (nil = 1:1) so
	// budget sums stay stable across override retunes.
	TokenRate  *float64
	Latency    time.Duration
	TTFT       time.Duration

	Failed       bool
	ErrorKind    string
	ErrorStatus  int
	ErrorMessage string
}

// recordUsage persists a metering row asynchronously. The write runs on a
// background context with its own timeout so a client disconnecting mid-stream
// cannot cancel the accounting for work the upstream already performed.
func (s *Server) recordUsage(rec usageRecord) {
	model := models.UsageRecord{
		APIKeyID:         optionalID(rec.APIKeyID),
		AccountID:        optionalID(rec.AccountID),
		Provider:         rec.Provider,
		Model:            rec.Model,
		Client:           rec.Client,
		ClientIP:         rec.ClientIP,
		RequestID:        rec.RequestID,
		Chain:            rec.Chain,
		PromptTokens:     rec.Usage.PromptTokens,
		CompletionTokens: rec.Usage.CompletionTokens,
		CachedTokens:     rec.Usage.CachedTokens,
		CacheWriteTokens: rec.Usage.CacheWriteTokens,
		ReasoningTokens:  rec.Usage.ReasoningTokens,
		CostMicros:       rec.CostMicros,
		TokenConsumptionRate: rec.TokenRate,
		LatencyMS:        int(rec.Latency.Milliseconds()),
		TTFTMS:           int(rec.TTFT.Milliseconds()),
		Failed:           rec.Failed,
		ErrorKind:        rec.ErrorKind,
		ErrorStatus:      rec.ErrorStatus,
		ErrorMessage:     sanitizeErrorMessage(rec.ErrorMessage),
		CreatedAt:        time.Now(),
	}

	s.metering.Add(1)
	go func() {
		defer s.metering.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.app.Repos.Usage.Insert(ctx, model); err != nil {
			s.log.Error("gateway record usage failed",
				"provider", model.Provider, "model", model.Model, "error", err)
		}
	}()
}

// recordFailure persists a failed attempt so the dashboard's recent-requests
// feed shows the real cause instead of a silent gap. Tokens and cost are zero:
// no usage was produced.
func (s *Server) recordFailure(meta requestMeta, at attempt, pe *core.ProviderError, latency time.Duration) {
	s.recordUsage(usageRecord{
		APIKeyID:     meta.APIKeyID,
		AccountID:    at.AccountID,
		Provider:     at.Target.Provider,
		Model:        at.Target.Model,
		Client:       meta.Client,
		ClientIP:     meta.ClientIP,
		RequestID:    meta.RequestID,
		Chain:        meta.Chain,
		Latency:      latency,
		Failed:       true,
		ErrorKind:    string(pe.Kind),
		ErrorStatus:  pe.StatusCode,
		ErrorMessage: pe.Message,
	})
}

// optionalID converts an id into the nullable form the usage table stores;
// the empty string becomes NULL so synthetic attempts and unattributed rows
// are distinguishable from real ids.
func optionalID(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}

// mergeUsage overlays the non-zero fields of a later usage event onto the
// accumulated one. Upstreams split accounting across events (Anthropic reports
// input tokens at message start and output tokens at message end), so the last
// non-zero value for each field wins.
//
// TotalTokens is only taken from the event when the upstream states it;
// otherwise it is recomputed, so a stream that reports prompt and completion
// tokens in separate events still totals correctly.
func mergeUsage(acc, next core.Usage) core.Usage {
	if next.PromptTokens != 0 {
		acc.PromptTokens = next.PromptTokens
	}
	if next.CompletionTokens != 0 {
		acc.CompletionTokens = next.CompletionTokens
	}
	if next.CachedTokens != 0 {
		acc.CachedTokens = next.CachedTokens
	}
	if next.CacheWriteTokens != 0 {
		acc.CacheWriteTokens = next.CacheWriteTokens
	}
	if next.ReasoningTokens != 0 {
		acc.ReasoningTokens = next.ReasoningTokens
	}
	if next.TotalTokens != 0 {
		acc.TotalTokens = next.TotalTokens
	} else {
		acc.TotalTokens = acc.PromptTokens + acc.CompletionTokens
	}
	return acc
}
