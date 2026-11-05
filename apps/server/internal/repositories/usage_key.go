package repositories

import (
	"context"
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
		SELECT strftime('%Y-%m-%d', created_at), `+requestCount+`,
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
	Provider         string `json:"provider"`
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
	CreatedAt          time.Time `json:"created_at"`
	Provider           string    `json:"provider"`
	Model              string    `json:"model"`
	PromptTokens       int64     `json:"prompt_tokens"`
	CompletionTokens   int64     `json:"completion_tokens"`
	CostMicros         int64     `json:"cost_micros"`
	LatencyMS          int64     `json:"latency_ms"`
	Failed             bool      `json:"failed"`
	CacheHit           bool      `json:"cache_hit"`
	PromptReducedBytes int64     `json:"prompt_reduced_bytes"`
	OutputShaped       bool      `json:"output_shaped"`
}

// RecentForKey returns one key's newest attempts since from, newest first.
func (r *UsageRepository) RecentForKey(ctx context.Context, keyID string, from time.Time, limit int) ([]KeyRequest, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT created_at, provider, model, prompt_tokens, completion_tokens, cost_micros,
		       latency_ms, failed, cache_hit, prompt_reduced_bytes, output_shaped
		FROM usage_records WHERE api_key_id = $1 AND created_at >= $2
		ORDER BY created_at DESC, id DESC LIMIT $3`, keyID, from, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []KeyRequest{}
	for rows.Next() {
		var q KeyRequest
		if err := rows.Scan(&q.CreatedAt, &q.Provider, &q.Model, &q.PromptTokens, &q.CompletionTokens,
			&q.CostMicros, &q.LatencyMS, &q.Failed, &q.CacheHit, &q.PromptReducedBytes, &q.OutputShaped); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, q)
	}
	return out, errtrace.Wrap(rows.Err())
}
