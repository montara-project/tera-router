package models

import "time"

// UsageRecord meters one completed request.
type UsageRecord struct {
	ID               int64     `json:"id"`
	APIKeyID         *string   `json:"api_key_id"`
	AccountID        *string   `json:"account_id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	Client           string    `json:"client"`
	ClientIP         string    `json:"client_ip"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	CachedTokens     int       `json:"cached_tokens"`
	CacheWriteTokens int       `json:"cache_write_tokens"`
	ReasoningTokens  int       `json:"reasoning_tokens"`
	CostMicros       int64     `json:"cost_micros"`
	CacheHit         bool      `json:"cache_hit"`
	LatencyMS        int       `json:"latency_ms"`
	TTFTMS           int       `json:"ttft_ms"`
	Failed           bool      `json:"failed"`
	ErrorKind        string    `json:"error_kind"`
	ErrorStatus      int       `json:"error_status"`
	ErrorMessage     string    `json:"error_message"`
	CreatedAt        time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (UsageRecord) TableName() string { return "usage_records" }
