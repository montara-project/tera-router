package repositories

import (
	"context"
	"database/sql"
	"time"

	"braces.dev/errtrace"
)

// requestCount counts client requests, not attempts: fallback re-attempts
// share a request_id, and rows without one count on their own.
const requestCount = `COUNT(DISTINCT CASE WHEN request_id <> '' THEN request_id ELSE 'row-' || id END)`

// KeyDailyUsage is one UTC day of one key's traffic.
type KeyDailyUsage struct {
	Day              string `json:"day"`
	Requests         int64  `json:"requests"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CostMicros       int64  `json:"cost_micros"`
}

// DailyForKey groups one key's traffic since from by UTC day. Days without
// traffic are left out.
func (r *UsageRepository) DailyForKey(ctx context.Context, keyID string, from time.Time) ([]KeyDailyUsage, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT `+dayBucket+`, `+requestCount+`,
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0)
		FROM usage_records WHERE api_key_id = $1 AND created_at >= $2
		GROUP BY 1 ORDER BY 1`, keyID, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []KeyDailyUsage{}
	for rows.Next() {
		var d KeyDailyUsage
		if err := rows.Scan(&d.Day, &d.Requests, &d.PromptTokens, &d.CompletionTokens, &d.CostMicros); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, d)
	}
	return out, errtrace.Wrap(rows.Err())
}

// KeyModelUsage is one provider/model of one key's traffic.
type KeyModelUsage struct {
	Provider string `json:"provider"`
	// APIKind is not a column: the portal handler fills it so the avatar matches /providers.
	APIKind          string `json:"api_kind,omitempty"`
	Model            string `json:"model"`
	Requests         int64  `json:"requests"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CostMicros       int64  `json:"cost_micros"`
}

// ByModelForKey groups one key's traffic since from by provider and model,
// busiest first.
func (r *UsageRepository) ByModelForKey(ctx context.Context, keyID string, from time.Time) ([]KeyModelUsage, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT provider, model, `+requestCount+` AS requests,
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0)
		FROM usage_records WHERE api_key_id = $1 AND created_at >= $2
		GROUP BY provider, model ORDER BY requests DESC, model`, keyID, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []KeyModelUsage{}
	for rows.Next() {
		var m KeyModelUsage
		if err := rows.Scan(&m.Provider, &m.Model, &m.Requests, &m.PromptTokens, &m.CompletionTokens, &m.CostMicros); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, m)
	}
	return out, errtrace.Wrap(rows.Err())
}

// KeyRequest is one attempt in a key's request log. It leaves out the client
// IP and error text: the usage portal shows it to whoever holds the link.
type KeyRequest struct {
	ID        int64     `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Provider  string    `json:"provider"`
	// APIKind is not a column: the portal handler fills it so the avatar matches /providers.
	APIKind          string `json:"api_kind,omitempty"`
	Model            string `json:"model"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CachedTokens     int64  `json:"cached_tokens"`
	CacheWriteTokens int64  `json:"cache_write_tokens"`
	ReasoningTokens  int64  `json:"reasoning_tokens"`
	CostMicros       int64  `json:"cost_micros"`
	// TokenConsumptionRate is the budget-drain multiplier at request time (nil = 1:1).
	TokenConsumptionRate *float64 `json:"token_consumption_rate"`
	LatencyMS            int64    `json:"latency_ms"`
	Failed               bool     `json:"failed"`
	CacheHit             bool     `json:"cache_hit"`
	PromptReducedBytes   int64    `json:"prompt_reduced_bytes"`
	OutputShaped         bool     `json:"output_shaped"`
}

// RecentForKey returns one page of a key's attempts since from, newest first,
// plus how many attempts the window holds.
func (r *UsageRepository) RecentForKey(ctx context.Context, keyID string, from time.Time, offset, limit int) ([]KeyRequest, int, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT id, created_at, provider, model, prompt_tokens, completion_tokens,
		       cached_tokens, cache_write_tokens, reasoning_tokens, cost_micros, token_consumption_rate,
		       latency_ms, failed, cache_hit, prompt_reduced_bytes, output_shaped, count(*) OVER () AS total
		FROM usage_records WHERE api_key_id = $1 AND created_at >= $2
		ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $3`, keyID, from, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []KeyRequest{}
	total := 0
	for rows.Next() {
		var q KeyRequest
		var rate sql.Null[float64]
		if err := rows.Scan(&q.ID, &q.CreatedAt, &q.Provider, &q.Model, &q.PromptTokens, &q.CompletionTokens,
			&q.CachedTokens, &q.CacheWriteTokens, &q.ReasoningTokens, &q.CostMicros, &rate,
			&q.LatencyMS, &q.Failed, &q.CacheHit, &q.PromptReducedBytes, &q.OutputShaped, &total); err != nil {
			return nil, 0, errtrace.Wrap(err)
		}
		if rate.Valid {
			q.TokenConsumptionRate = &rate.V
		}
		out = append(out, q)
	}
	return out, total, errtrace.Wrap(rows.Err())
}
