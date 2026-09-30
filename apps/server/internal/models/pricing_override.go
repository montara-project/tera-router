package models

import "time"

// PricingOverride sets per-provider/model rates in micros (millionths of a
// dollar per million tokens).
type PricingOverride struct {
	ID               string    `json:"id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	InputMicros      int64     `json:"input_micros"`
	OutputMicros     int64     `json:"output_micros"`
	CacheReadMicros  int64     `json:"cache_read_micros"`
	CacheWriteMicros int64     `json:"cache_write_micros"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
