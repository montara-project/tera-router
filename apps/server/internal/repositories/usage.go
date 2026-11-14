package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// UsageRepository appends request telemetry and aggregates it for the
// dashboard.
//
// created_at is UTC text, "YYYY-MM-DD HH:MM:SS.fff+00:00": the DSN writes
// time.Time with _time_format=sqlite and _timezone=UTC (database/sqlite.go),
// and the column default uses the same layout. Day and hour buckets are
// therefore plain prefixes (dayBucket, hourBucket), about twice as fast over
// a large window as strftime, which parses every row.
type UsageRepository struct {
	BaseRepository
}

const (
	dayBucket  = `substr(created_at, 1, 10)`
	hourBucket = `substr(created_at, 1, 13) || ':00'`
)

// Insert appends one usage record.
func (r *UsageRepository) Insert(ctx context.Context, u models.UsageRecord) error {
	rules, err := json.Marshal(nonNilMap(u.SavingRules))
	if err != nil {
		return errtrace.Wrap(err)
	}
	directives, err := json.Marshal(nonNilSlice(u.OutputDirectives))
	if err != nil {
		return errtrace.Wrap(err)
	}
	_, err = r.execContext(ctx, r.DB, `
		INSERT INTO usage_records (api_key_id, account_id, provider, model, client, client_ip,
			request_id, chain,
			prompt_tokens, completion_tokens, cached_tokens, cache_write_tokens, reasoning_tokens,
			cost_micros, token_consumption_rate, cache_hit, latency_ms, ttft_ms, failed, error_kind, error_status, error_message, created_at,
			prompt_reduced_bytes, output_shaped, saving_rules, output_directives)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
		u.APIKeyID, u.AccountID, u.Provider, u.Model, u.Client, u.ClientIP,
		u.RequestID, u.Chain,
		u.PromptTokens, u.CompletionTokens, u.CachedTokens, u.CacheWriteTokens, u.ReasoningTokens,
		u.CostMicros, u.TokenConsumptionRate, u.CacheHit, u.LatencyMS, u.TTFTMS, u.Failed, u.ErrorKind, u.ErrorStatus,
		u.ErrorMessage, u.CreatedAt,
		u.PromptReducedBytes, u.OutputShaped, string(rules), string(directives),
	)
	return err
}

func nonNilMap(m map[string]int) map[string]int {
	if m == nil {
		return map[string]int{}
	}
	return m
}

func nonNilSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// UsageSpend totals spend and tokens over a window, narrowed to one budget
// scope. It is the budget read for the gateway guard and the dashboard.
type UsageSpend struct {
	CostMicros       int64 `json:"cost_micros"`
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
	// BudgetTokens is the rate-scaled token drain: each row contributes
	// (prompt + completion) × its snapshotted token_consumption_rate, with
	// NULL counting 1:1. Token budgets compare against this, not the raw sum.
	BudgetTokens int64 `json:"budget_tokens"`
}

// SumSince totals spend and tokens for usage created at or after from, for
// one budget scope: tenant counts every request, api_key only that key's
// requests, account only requests served by that provider account.
func (r *UsageRepository) SumSince(ctx context.Context, scope models.BudgetScope, scopeID string, from time.Time) (UsageSpend, error) {
	query := `
		SELECT COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(CAST(SUM((prompt_tokens + completion_tokens) * COALESCE(token_consumption_rate, 1)) AS INTEGER), 0)
		FROM usage_records WHERE created_at >= $1`
	args := []any{from}
	switch scope {
	case models.ScopeAPIKey:
		query += ` AND api_key_id = $2`
		args = append(args, scopeID)
	case models.ScopeAccount:
		query += ` AND account_id = $2`
		args = append(args, scopeID)
	}

	var s UsageSpend
	err := r.queryRowContext(ctx, r.DB, query, args...).
		Scan(&s.CostMicros, &s.PromptTokens, &s.CompletionTokens, &s.BudgetTokens)
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

// CountSince counts the client requests the gateway served since from.
// Requests are deduplicated by request_id so fallback re-attempts count once,
// matching SummaryForKey.
func (r *UsageRepository) CountSince(ctx context.Context, from time.Time) (int64, error) {
	var n int64
	err := r.queryRowContext(ctx, r.DB, `
		SELECT COUNT(DISTINCT CASE WHEN request_id <> '' THEN request_id ELSE 'row-' || id END)
		FROM usage_records WHERE created_at >= $1`, from.UTC()).Scan(&n)
	return n, errtrace.Wrap(err)
}

// SummaryForKey totals one API key's traffic since from. Requests counts
// client requests, not attempts: fallback re-attempts share a request_id.
func (r *UsageRepository) SummaryForKey(ctx context.Context, keyID string, from time.Time) (UsageSummary, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT COUNT(DISTINCT CASE WHEN request_id <> '' THEN request_id ELSE 'row-' || id END),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cost_micros), 0), CAST(COALESCE(AVG(latency_ms), 0) AS INTEGER)
		FROM usage_records WHERE api_key_id = $1 AND created_at >= $2`, keyID, from)

	var s UsageSummary
	err := row.Scan(&s.Requests, &s.PromptTokens, &s.CompletionTokens, &s.CostMicros, &s.AvgLatencyMS)
	return s, errtrace.Wrap(err)
}

// Summary totals spend and tokens over a window.
func (r *UsageRepository) Summary(ctx context.Context, from time.Time) (UsageSummary, error) {
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
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT `+dayBucket+` AS day,
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
	// CostMicros is the recorded spend (prices set later are not re-derived).
	CostMicros int64 `json:"cost_micros"`
	// The token-saving counters cover successful attempts only, so a request
	// that fell back is not counted once per attempt.
	PromptReducedBytes int64 `json:"prompt_reduced_bytes"`
	CompressedRequests int64 `json:"compressed_requests"`
	ShapedRequests     int64 `json:"shaped_requests"`
}

// Traffic totals requests, failures, the token classes and the token-saving
// counters over [from, to).
func (r *UsageRepository) Traffic(ctx context.Context, from, to time.Time) (UsageTraffic, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT count(*), COALESCE(SUM(failed), 0),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(cached_tokens), 0), COALESCE(SUM(cache_write_tokens), 0),
		       COALESCE(SUM(reasoning_tokens), 0), COALESCE(SUM(cache_hit), 0),
		       COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(CASE WHEN failed = 0 THEN prompt_reduced_bytes ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN failed = 0 AND prompt_reduced_bytes > 0 THEN 1 ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN failed = 0 AND output_shaped = 1 THEN 1 ELSE 0 END), 0)
		FROM usage_records WHERE created_at >= $1 AND created_at < $2`, from, to)

	var t UsageTraffic
	err := row.Scan(&t.Requests, &t.Failed, &t.PromptTokens, &t.CompletionTokens,
		&t.CachedTokens, &t.CacheWriteTokens, &t.ReasoningTokens, &t.CacheHits,
		&t.CostMicros, &t.PromptReducedBytes, &t.CompressedRequests, &t.ShapedRequests)
	return t, errtrace.Wrap(err)
}

// UsageSavingBreakdown splits the window's token savings: bytes removed per
// compression rule and requests per output-shaping directive. Like the
// Traffic counters it covers successful attempts only.
type UsageSavingBreakdown struct {
	RuleBytes      map[string]int64
	DirectiveCount map[string]int64
}

// SavingBreakdown aggregates saving_rules and output_directives over [from, to).
func (r *UsageRepository) SavingBreakdown(ctx context.Context, from, to time.Time) (UsageSavingBreakdown, error) {
	out := UsageSavingBreakdown{RuleBytes: map[string]int64{}, DirectiveCount: map[string]int64{}}
	for _, q := range []struct {
		sql  string
		into map[string]int64
	}{
		{`SELECT j.key, SUM(j.value) FROM usage_records, json_each(usage_records.saving_rules) AS j
		  WHERE created_at >= $1 AND created_at < $2 AND failed = 0 GROUP BY j.key`, out.RuleBytes},
		{`SELECT j.value, count(*) FROM usage_records, json_each(usage_records.output_directives) AS j
		  WHERE created_at >= $1 AND created_at < $2 AND failed = 0 GROUP BY j.value`, out.DirectiveCount},
	} {
		rows, err := r.queryContext(ctx, r.DB, q.sql, from, to)
		if err != nil {
			return out, errtrace.Wrap(err)
		}
		for rows.Next() {
			var key string
			var n int64
			if err := rows.Scan(&key, &n); err != nil {
				rows.Close()
				return out, errtrace.Wrap(err)
			}
			q.into[key] = n
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return out, errtrace.Wrap(err)
		}
	}
	return out, nil
}

// Latencies returns the latency of every successful attempt in [from, to),
// sorted ascending, for percentile math.
// ponytail: loads the whole window into memory; switch to a SQL percentile
// (or sampling) if a window ever holds millions of rows.
func (r *UsageRepository) Latencies(ctx context.Context, from, to time.Time) ([]int, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT latency_ms FROM usage_records
		WHERE created_at >= $1 AND created_at < $2 AND failed = 0
		ORDER BY latency_ms`, from, to)
	if err != nil {
		return nil, errtrace.Wrap(err)
	}
	defer rows.Close()

	out := []int{}
	for rows.Next() {
		var ms int
		if err := rows.Scan(&ms); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, ms)
	}
	return out, errtrace.Wrap(rows.Err())
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

// DailyWithFailures aggregates requests, tokens, spend, failures and the
// average successful latency per bucket: one bucket per day, or per hour when
// hourly is set (short windows).
func (r *UsageRepository) DailyWithFailures(ctx context.Context, from time.Time, hourly bool) ([]UsageDailyWithFailures, error) {
	bucket := dayBucket
	if hourly {
		bucket = hourBucket
	}
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT `+bucket+` AS day,
		       count(*),
		       COALESCE(SUM(cost_micros), 0),
		       COALESCE(SUM(prompt_tokens + completion_tokens), 0),
		       COALESCE(SUM(failed), 0),
		       CAST(COALESCE(AVG(CASE WHEN failed = 0 THEN latency_ms END), 0) AS INTEGER)
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
		if err := rows.Scan(&d.Day, &d.Requests, &d.CostMicros, &d.Tokens, &d.Failed, &d.LatencyMS); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, d)
	}
	return out, errtrace.Wrap(rows.Err())
}

// UsageDailyWithFailures is one bucket of the trend series. Day is
// "2006-01-02", or "2006-01-02 15:00" for hourly buckets.
type UsageDailyWithFailures struct {
	Day        string `json:"day"`
	Requests   int64  `json:"requests"`
	CostMicros int64  `json:"cost_micros"`
	Tokens     int64  `json:"tokens"`
	Failed     int64  `json:"failed"`
	LatencyMS  int64  `json:"latency_ms"`
}

// UsageActivityRow is one day × model cell of the activity calendar.
type UsageActivityRow struct {
	Day      string
	Provider string
	Model    string
	Requests int64
	Failed   int64
}

// Activity counts requests per UTC day and model since from, ordered by day
// and then by request count (busiest model first).
func (r *UsageRepository) Activity(ctx context.Context, from time.Time) ([]UsageActivityRow, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT `+dayBucket+` AS day, provider, model,
		       count(*), COALESCE(SUM(failed), 0)
		FROM usage_records
		WHERE created_at >= $1
		GROUP BY 1, 2, 3
		ORDER BY 1, 4 DESC, 3`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UsageActivityRow{}
	for rows.Next() {
		var a UsageActivityRow
		if err := rows.Scan(&a.Day, &a.Provider, &a.Model, &a.Requests, &a.Failed); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, a)
	}
	return out, errtrace.Wrap(rows.Err())
}

// Recent returns the newest usage rows created at or after from, for the
// request log of the selected period, with the API key's name filled in.
func (r *UsageRepository) Recent(ctx context.Context, from time.Time, limit int) ([]models.UsageRecord, error) {
	rows, _, err := r.Requests(ctx, from, UsageRequestFilter{}, 0, limit)
	return rows, err
}

// UsageRequestFilter narrows the request log. Empty fields match everything.
type UsageRequestFilter struct {
	// Search is a case-insensitive substring of the model, the API key's
	// name, the client, the row id or the provider slug.
	Search string
	// Providers are slugs that also match: the handler resolves a search
	// that hits a provider's display name to its slug.
	Providers []string
	// FailedOnly keeps the failed attempts.
	FailedOnly bool
}

// Requests returns one page of the usage rows created at or after from,
// newest first, with the API key's name filled in, plus the filtered total.
func (r *UsageRepository) Requests(ctx context.Context, from time.Time, f UsageRequestFilter, offset, limit int) ([]models.UsageRecord, int, error) {
	providers, err := json.Marshal(f.Providers)
	if err != nil {
		return nil, 0, errtrace.Wrap(err)
	}
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT u.id, u.api_key_id, u.account_id, u.provider, u.model, u.client, u.client_ip,
		       u.prompt_tokens, u.completion_tokens, u.cached_tokens, u.cache_write_tokens, u.reasoning_tokens,
		       u.cost_micros, u.token_consumption_rate, u.cache_hit, u.latency_ms, u.ttft_ms, u.failed, u.error_kind, u.error_status,
		       u.error_message, u.created_at, COALESCE(k.name, ''), count(*) OVER () AS total
		FROM usage_records u LEFT JOIN api_keys k ON k.id = u.api_key_id
		WHERE u.created_at >= $1
		AND ($2 = '' OR instr(lower(u.model || ' ' || COALESCE(k.name, '') || ' ' || u.client || ' ' || u.id || ' ' || u.provider), lower($2)) > 0
			OR u.provider IN (SELECT value FROM json_each($3)))
		AND ($4 = false OR u.failed = true)
		ORDER BY u.created_at DESC, u.id DESC LIMIT $6 OFFSET $5`, from, f.Search, string(providers), f.FailedOnly, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []models.UsageRecord{}
	total := 0
	for rows.Next() {
		var u models.UsageRecord
		var rate sql.Null[float64]
		if err := rows.Scan(&u.ID, &u.APIKeyID, &u.AccountID, &u.Provider, &u.Model, &u.Client, &u.ClientIP,
			&u.PromptTokens, &u.CompletionTokens, &u.CachedTokens, &u.CacheWriteTokens, &u.ReasoningTokens,
			&u.CostMicros, &rate, &u.CacheHit, &u.LatencyMS, &u.TTFTMS, &u.Failed, &u.ErrorKind, &u.ErrorStatus,
			&u.ErrorMessage, &u.CreatedAt, &u.KeyName, &total); err != nil {
			return nil, 0, errtrace.Wrap(err)
		}
		if rate.Valid {
			u.TokenConsumptionRate = &rate.V
		}
		out = append(out, u)
	}
	return out, total, errtrace.Wrap(rows.Err())
}

// RequestCounts returns how many usage rows were created at or after from,
// and how many of them failed: the figures on the request log's status chips.
func (r *UsageRepository) RequestCounts(ctx context.Context, from time.Time) (all, failed int, err error) {
	rows, err := r.queryContext(ctx, r.DB,
		`SELECT count(*), coalesce(sum(failed), 0) FROM usage_records WHERE created_at >= $1`, from)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	if rows.Next() {
		if err := rows.Scan(&all, &failed); err != nil {
			return 0, 0, errtrace.Wrap(err)
		}
	}
	return all, failed, errtrace.Wrap(rows.Err())
}

// UsageHealthRow is one attempt's outcome, the minimal projection provider
// health aggregates over. Rows are grouped by RequestID to separate fallbacks
// (the request later succeeded elsewhere) from final failures.
type UsageHealthRow struct {
	RequestID string
	Chain     string
	Provider  string
	Model     string
	Failed    bool
	LatencyMS int
	CreatedAt time.Time
	// ErrorKind is the gateway's failure class (auth, rate_limit, …); empty on success.
	ErrorKind string
	// Tokens is the attempt's prompt plus completion tokens.
	Tokens int64
}

// HealthRows streams the outcome-relevant columns of every usage record in the
// window, oldest first so request grouping sees the final attempt last.
func (r *UsageRepository) HealthRows(ctx context.Context, from time.Time) ([]UsageHealthRow, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT request_id, chain, provider, model, failed, latency_ms, created_at, error_kind,
		       prompt_tokens + completion_tokens
		FROM usage_records WHERE created_at >= $1 ORDER BY created_at`, from)
	if err != nil {
		return nil, errtrace.Wrap(err)
	}
	defer rows.Close()

	out := make([]UsageHealthRow, 0, 64)
	for rows.Next() {
		var u UsageHealthRow
		if err := rows.Scan(&u.RequestID, &u.Chain, &u.Provider, &u.Model, &u.Failed, &u.LatencyMS, &u.CreatedAt, &u.ErrorKind, &u.Tokens); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, u)
	}
	return out, errtrace.Wrap(rows.Err())
}
