package models

import "time"

// UsageRecord meters one completed request.
type UsageRecord struct {
	ID        int64   `json:"id"`
	APIKeyID  *string `json:"api_key_id"`
	AccountID *string `json:"account_id"`
	Provider  string  `json:"provider"`
	Model     string  `json:"model"`
	Client    string  `json:"client"`
	ClientIP  string  `json:"client_ip"`
	// RequestID groups the usage rows produced by one client request: each
	// fallback re-attempt writes its own row under the same id, which is what
	// lets provider health tell fallbacks apart from final failures.
	RequestID string `json:"request_id"`
	// Chain is the routing chain the request resolved through, or "" when it
	// named an alias or provider/model directly.
	Chain            string `json:"chain"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	CachedTokens     int    `json:"cached_tokens"`
	CacheWriteTokens int    `json:"cache_write_tokens"`
	ReasoningTokens  int    `json:"reasoning_tokens"`
	CostMicros       int64  `json:"cost_micros"`
	// TokenConsumptionRate snapshots the model's budget-drain multiplier at
	// request time (nil = no override, 1:1). Cost is never scaled; token
	// budgets sum prompt+completion times this rate.
	TokenConsumptionRate *float64  `json:"token_consumption_rate,omitempty"`
	CacheHit             bool      `json:"cache_hit"`
	LatencyMS            int       `json:"latency_ms"`
	TTFTMS               int       `json:"ttft_ms"`
	Failed               bool      `json:"failed"`
	ErrorKind            string    `json:"error_kind"`
	ErrorStatus          int       `json:"error_status"`
	ErrorMessage         string    `json:"error_message"`
	CreatedAt            time.Time `json:"created_at"`
}
