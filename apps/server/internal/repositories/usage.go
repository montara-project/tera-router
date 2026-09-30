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
	return r.insertExec(ctx, u)
}

func (r *UsageRepository) insertExec(ctx context.Context, u models.UsageRecord) error {
	_, err := r.execContext(ctx, r.DB, `
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

// UsageSpend totals spend and tokens over a window, optionally narrowed to a
// single API key. It is the gateway's budget-guard read.
type UsageSpend struct {
	CostMicros       int64 `json:"cost_micros"`
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
}

// SumSince totals spend and tokens for usage created at or after from. When
// apiKeyID is non-nil the sum is restricted to that key (the api_key budget
// scope); nil means every key (the tenant scope).
func (r *UsageRepository) SumSince(ctx context.Context, apiKeyID *string, from time.Time) (UsageSpend, error) {
	return r.sumSinceExec(ctx, apiKeyID, from)
}

func (r *UsageRepository) sumSinceExec(ctx context.Context, apiKeyID *string, from time.Time) (UsageSpend, error) {
	query := `
		SELECT COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0)
		FROM usage_records WHERE created_at >= $1`
	args := []any{from}
	if apiKeyID != nil {
		query += ` AND api_key_id = $2`
		args = append(args, *apiKeyID)
	}

	var s UsageSpend
	err := r.queryRowContext(ctx, r.DB, query, args...).
		Scan(&s.CostMicros, &s.PromptTokens, &s.CompletionTokens)
	return s, errtrace.Wrap(err)
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
	return r.summaryExec(ctx, from)
}

func (r *UsageRepository) summaryExec(ctx context.Context, from time.Time) (UsageSummary, error) {
	row := r.queryRowContext(ctx, r.DB, `
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
	return r.byModelExec(ctx, from)
}

func (r *UsageRepository) byModelExec(ctx context.Context, from time.Time) ([]UsageByModel, error) {
	rows, err := r.queryContext(ctx, r.DB, `
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
	return r.dailyExec(ctx, from)
}

func (r *UsageRepository) dailyExec(ctx context.Context, from time.Time) ([]UsageDaily, error) {
	rows, err := r.queryContext(ctx, r.DB, `
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
	return r.byAccountExec(ctx, from)
}

func (r *UsageRepository) byAccountExec(ctx context.Context, from time.Time) ([]UsageByAccount, error) {
	rows, err := r.queryContext(ctx, r.DB, `
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
	return r.byAPIKeyExec(ctx, from)
}

func (r *UsageRepository) byAPIKeyExec(ctx context.Context, from time.Time) ([]UsageByAccount, error) {
	rows, err := r.queryContext(ctx, r.DB, `
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

// UsageTraffic totals requests and tokens over a window, split by outcome.
type UsageTraffic struct {
	Requests         int64 `json:"requests"`
	Failed           int64 `json:"failed"`
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
	CachedTokens     int64 `json:"cached_tokens"`
	CacheWriteTokens int64 `json:"cache_write_tokens"`
	ReasoningTokens  int64 `json:"reasoning_tokens"`
	CacheHits        int64 `json:"cache_hits"`
}

// Traffic totals requests, failures and the token classes over a window.
func (r *UsageRepository) Traffic(ctx context.Context, from time.Time) (UsageTraffic, error) {
	return r.trafficExec(ctx, from)
}

func (r *UsageRepository) trafficExec(ctx context.Context, from time.Time) (UsageTraffic, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT count(*), COALESCE(SUM(failed), 0),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cached_tokens), 0), COALESCE(SUM(cache_write_tokens), 0),
		       COALESCE(SUM(reasoning_tokens), 0), COALESCE(SUM(cache_hit), 0)
		FROM usage_records WHERE created_at >= $1`, from)

	var t UsageTraffic
	err := row.Scan(&t.Requests, &t.Failed, &t.PromptTokens, &t.CompletionTokens,
		&t.CachedTokens, &t.CacheWriteTokens, &t.ReasoningTokens, &t.CacheHits)
	return t, errtrace.Wrap(err)
}

// UsagePerformance averages latency and TTFT over successful requests.
type UsagePerformance struct {
	Requests    int64 `json:"requests"`
	AvgMS       int64 `json:"avg_ms"`
	TTFTMS      int64 `json:"ttft_ms"`
	TTFTSamples int64 `json:"ttft_samples"`
}

// Performance averages latency (and TTFT where recorded) over the window.
// Failed attempts are excluded: they carry no meaningful completion latency.
func (r *UsageRepository) Performance(ctx context.Context, from time.Time) (UsagePerformance, error) {
	return r.performanceExec(ctx, from)
}

func (r *UsageRepository) performanceExec(ctx context.Context, from time.Time) (UsagePerformance, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT count(*),
		       CAST(COALESCE(AVG(latency_ms), 0) AS INTEGER),
		       CAST(COALESCE(AVG(NULLIF(ttft_ms, 0)), 0) AS INTEGER),
		       COALESCE(SUM(CASE WHEN ttft_ms > 0 THEN 1 ELSE 0 END), 0)
		FROM usage_records WHERE created_at >= $1 AND failed = 0`, from)

	var p UsagePerformance
	err := row.Scan(&p.Requests, &p.AvgMS, &p.TTFTMS, &p.TTFTSamples)
	return p, errtrace.Wrap(err)
}

// UsageGroup aggregates one provider or model over a window. The token
// classes are reported separately so the dashboard can show cache and
// reasoning composition rather than a single lump.
type UsageGroup struct {
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	Requests         int64  `json:"requests"`
	Failed           int64  `json:"failed"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CachedTokens     int64  `json:"cached_tokens"`
	CacheWriteTokens int64  `json:"cache_write_tokens"`
	ReasoningTokens  int64  `json:"reasoning_tokens"`
	CostMicros       int64  `json:"cost_micros"`
	AvgLatencyMS     int64  `json:"avg_latency_ms"`
	AvgTTFTMS        int64  `json:"avg_ttft_ms"`
}

// ByProvider groups the window by provider.
func (r *UsageRepository) ByProvider(ctx context.Context, from time.Time) ([]UsageGroup, error) {
	return r.groupExec(ctx, from, "provider")
}

// ByModelGrouped groups the window by provider and model.
func (r *UsageRepository) ByModelGrouped(ctx context.Context, from time.Time) ([]UsageGroup, error) {
	return r.groupExec(ctx, from, "provider, model")
}

func (r *UsageRepository) groupExec(ctx context.Context, from time.Time, groupBy string) ([]UsageGroup, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT provider, model, count(*), COALESCE(SUM(failed), 0),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cached_tokens), 0), COALESCE(SUM(cache_write_tokens), 0),
		       COALESCE(SUM(reasoning_tokens), 0), COALESCE(SUM(cost_micros), 0),
		       CAST(COALESCE(AVG(latency_ms), 0) AS INTEGER),
		       CAST(COALESCE(AVG(NULLIF(ttft_ms, 0)), 0) AS INTEGER)
		FROM usage_records WHERE created_at >= $1
		GROUP BY `+groupBy+`
		ORDER BY count(*) DESC`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageGroup{}
	for rows.Next() {
		var g UsageGroup
		if err := rows.Scan(&g.Provider, &g.Model, &g.Requests, &g.Failed,
			&g.PromptTokens, &g.CompletionTokens, &g.CachedTokens, &g.CacheWriteTokens,
			&g.ReasoningTokens, &g.CostMicros, &g.AvgLatencyMS, &g.AvgTTFTMS); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, g)
	}
	return out, errtrace.Wrap(rows.Err())
}

// DailyWithFailures aggregates per-day requests, tokens, spend and failures.
func (r *UsageRepository) DailyWithFailures(ctx context.Context, from time.Time) ([]UsageDailyWithFailures, error) {
	return r.dailyWithFailuresExec(ctx, from)
}

// UsageDailyWithFailures is one day of the trend series.
type UsageDailyWithFailures struct {
	Day        string `json:"day"`
	Requests   int64  `json:"requests"`
	CostMicros int64  `json:"cost_micros"`
	Tokens     int64  `json:"tokens"`
	Failed     int64  `json:"failed"`
}

func (r *UsageRepository) dailyWithFailuresExec(ctx context.Context, from time.Time) ([]UsageDailyWithFailures, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT strftime('%Y-%m-%d', created_at) AS day,
		       count(*),
		       COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(prompt_tokens + completion_tokens), 0),
		       COALESCE(SUM(failed), 0)
		FROM usage_records
		WHERE created_at >= $1
		GROUP BY 1
		ORDER BY 1`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageDailyWithFailures{}
	for rows.Next() {
		var d UsageDailyWithFailures
		if err := rows.Scan(&d.Day, &d.Requests, &d.CostMicros, &d.Tokens, &d.Failed); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, d)
	}
	return out, errtrace.Wrap(rows.Err())
}

// Recent returns the newest usage rows for the request log.
func (r *UsageRepository) Recent(ctx context.Context, limit int) ([]models.UsageRecord, error) {
	return r.recentExec(ctx, limit)
}

func (r *UsageRepository) recentExec(ctx context.Context, limit int) ([]models.UsageRecord, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT id, api_key_id, account_id, provider, model, client, client_ip,
		       prompt_tokens, completion_tokens, cached_tokens, cache_write_tokens, reasoning_tokens,
		       cost_micros, cache_hit, latency_ms, ttft_ms, failed, error_kind, error_status,
		       error_message, created_at
		FROM usage_records ORDER BY created_at DESC, id DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.UsageRecord{}
	for rows.Next() {
		var u models.UsageRecord
		if err := rows.Scan(&u.ID, &u.APIKeyID, &u.AccountID, &u.Provider, &u.Model, &u.Client, &u.ClientIP,
			&u.PromptTokens, &u.CompletionTokens, &u.CachedTokens, &u.CacheWriteTokens, &u.ReasoningTokens,
			&u.CostMicros, &u.CacheHit, &u.LatencyMS, &u.TTFTMS, &u.Failed, &u.ErrorKind, &u.ErrorStatus,
			&u.ErrorMessage, &u.CreatedAt); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, u)
	}
	return out, errtrace.Wrap(rows.Err())
}
