package repositories

import (
	"context"
	"time"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// UsageRepository appends request telemetry and aggregates it for the
// dashboard.
type UsageRepository struct {
	BaseRepository
}

// Insert appends one usage record.
func (r *UsageRepository) Insert(ctx context.Context, u models.UsageRecord) error {
	return r.insertExec(ctx, r.DB, u)
}

func (r *UsageRepository) insertExec(ctx context.Context, ex Executor, u models.UsageRecord) error {
	_, err := r.execContext(ctx, ex, `
		INSERT INTO usage_records (api_key_id, account_id, provider, model, client, client_ip,
			prompt_tokens, completion_tokens, cached_tokens, cache_write_tokens, reasoning_tokens,
			cost_micros, cache_hit, latency_ms, ttft_ms, failed, error_kind, error_status, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
		u.APIKeyID, u.AccountID, u.Provider, u.Model, u.Client, u.ClientIP,
		u.PromptTokens, u.CompletionTokens, u.CachedTokens, u.CacheWriteTokens, u.ReasoningTokens,
		u.CostMicros, u.CacheHit, u.LatencyMS, u.TTFTMS, u.Failed, u.ErrorKind, u.ErrorStatus,
		u.ErrorMessage, u.CreatedAt,
	)
	return err
}

// UsageSummary totals spend and tokens over a window.
type UsageSummary struct {
	Requests         int64 `json:"requests"`
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
	CostMicros       int64 `json:"cost_micros"`
	AvgLatencyMS     int64 `json:"avg_latency_ms"`
}

// Summary totals spend and tokens over a window.
func (r *UsageRepository) Summary(ctx context.Context, from time.Time) (UsageSummary, error) {
	return r.summaryExec(ctx, r.DB, from)
}

func (r *UsageRepository) summaryExec(ctx context.Context, ex Executor, from time.Time) (UsageSummary, error) {
	row := r.queryRowContext(ctx, ex, `
		SELECT count(*),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0), CAST(COALESCE(AVG(latency_ms), 0) AS INTEGER)
		FROM usage_records WHERE created_at >= $1`, from)

	var s UsageSummary
	err := row.Scan(&s.Requests, &s.PromptTokens, &s.CompletionTokens, &s.CostMicros, &s.AvgLatencyMS)
	return s, errtrace.Wrap(err)
}

// UsageByModel aggregates tokens and spend per provider/model over a window.
type UsageByModel struct {
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	Requests         int64  `json:"requests"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CostMicros       int64  `json:"cost_micros"`
	AvgLatencyMS     int64  `json:"avg_latency_ms"`
}

// ByModel aggregates tokens and spend per provider/model over a window.
func (r *UsageRepository) ByModel(ctx context.Context, from time.Time) ([]UsageByModel, error) {
	return r.byModelExec(ctx, r.DB, from)
}

func (r *UsageRepository) byModelExec(ctx context.Context, ex Executor, from time.Time) ([]UsageByModel, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT provider, model, count(*) AS requests,
		       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		       COALESCE(SUM(cost_micros), 0) AS cost_micros,
		       CAST(COALESCE(AVG(latency_ms), 0) AS INTEGER) AS avg_latency_ms
		FROM usage_records
		WHERE created_at >= $1
		GROUP BY provider, model
		ORDER BY cost_micros DESC, requests DESC`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageByModel{}
	for rows.Next() {
		var m UsageByModel
		if err := rows.Scan(&m.Provider, &m.Model, &m.Requests, &m.PromptTokens, &m.CompletionTokens, &m.CostMicros, &m.AvgLatencyMS); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, m)
	}
	return out, errtrace.Wrap(rows.Err())
}

// UsageDaily aggregates spend/tokens per day for charts and insights.
type UsageDaily struct {
	Day        string `json:"day"`
	Requests   int64  `json:"requests"`
	CostMicros int64  `json:"cost_micros"`
	Tokens     int64  `json:"tokens"`
}

// Daily aggregates spend and tokens per day over a window.
func (r *UsageRepository) Daily(ctx context.Context, from time.Time) ([]UsageDaily, error) {
	return r.dailyExec(ctx, r.DB, from)
}

func (r *UsageRepository) dailyExec(ctx context.Context, ex Executor, from time.Time) ([]UsageDaily, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT strftime('%Y-%m-%d', created_at) AS day,
		       count(*) AS requests,
		       COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(prompt_tokens + completion_tokens), 0)
		FROM usage_records
		WHERE created_at >= $1
		GROUP BY 1
		ORDER BY 1`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageDaily{}
	for rows.Next() {
		var d UsageDaily
		if err := rows.Scan(&d.Day, &d.Requests, &d.CostMicros, &d.Tokens); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, d)
	}
	return out, errtrace.Wrap(rows.Err())
}

// UsageByAccount aggregates usage per account id over a window (quota page).
type UsageByAccount struct {
	AccountID    string `json:"account_id"`
	Requests     int64  `json:"requests"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
	CostMicros   int64  `json:"cost_micros"`
}

// ByAccount aggregates usage per account id over a window.
func (r *UsageRepository) ByAccount(ctx context.Context, from time.Time) ([]UsageByAccount, error) {
	return r.byAccountExec(ctx, r.DB, from)
}

func (r *UsageRepository) byAccountExec(ctx context.Context, ex Executor, from time.Time) ([]UsageByAccount, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT account_id, count(*) AS requests,
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0)
		FROM usage_records
		WHERE created_at >= $1 AND account_id IS NOT NULL
		GROUP BY account_id`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageByAccount{}
	for rows.Next() {
		var a UsageByAccount
		if err := rows.Scan(&a.AccountID, &a.Requests, &a.InputTokens, &a.OutputTokens, &a.CostMicros); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, a)
	}
	return out, errtrace.Wrap(rows.Err())
}

// ByAPIKey aggregates usage per key over a window.
func (r *UsageRepository) ByAPIKey(ctx context.Context, from time.Time) ([]UsageByAccount, error) {
	return r.byAPIKeyExec(ctx, r.DB, from)
}

func (r *UsageRepository) byAPIKeyExec(ctx context.Context, ex Executor, from time.Time) ([]UsageByAccount, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT api_key_id, count(*) AS requests,
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0)
		FROM usage_records
		WHERE created_at >= $1 AND api_key_id IS NOT NULL
		GROUP BY api_key_id`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageByAccount{}
	for rows.Next() {
		var a UsageByAccount
		if err := rows.Scan(&a.AccountID, &a.Requests, &a.InputTokens, &a.OutputTokens, &a.CostMicros); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, a)
	}
	return out, errtrace.Wrap(rows.Err())
}
