package gateway

import (
	"context"
	"testing"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

func TestKeyLimiterRPM(t *testing.T) {
	l := newKeyLimiter()
	now := time.Now()
	for i := range 3 {
		if _, pe := l.admit("k", 3, 0, now.Add(time.Duration(i)*time.Second)); pe != nil {
			t.Fatalf("request %d blocked: %v", i+1, pe.Message)
		}
	}
	_, pe := l.admit("k", 3, 0, now.Add(10*time.Second))
	if pe == nil || pe.Kind != core.ErrRateLimit {
		t.Fatal("4th request in the minute must be rate limited")
	}
	if pe.RetryAfter != 50*time.Second {
		t.Errorf("RetryAfter = %v, want 50s (until the oldest hit leaves the window)", pe.RetryAfter)
	}
	if _, pe := l.admit("other", 3, 0, now.Add(10*time.Second)); pe != nil {
		t.Error("another key must have its own window")
	}
	if _, pe := l.admit("k", 3, 0, now.Add(61*time.Second)); pe != nil {
		t.Errorf("after the window slides the key is admitted again: %v", pe.Message)
	}
}

func TestKeyLimiterConcurrent(t *testing.T) {
	l := newKeyLimiter()
	now := time.Now()
	r1, _ := l.admit("k", 0, 2, now)
	r2, _ := l.admit("k", 0, 2, now)
	if _, pe := l.admit("k", 0, 2, now); pe == nil {
		t.Fatal("third concurrent request must be limited")
	}
	r1()
	r1() // releasing twice must not free a second slot
	if _, pe := l.admit("k", 0, 2, now); pe != nil {
		t.Fatalf("a freed slot must admit: %v", pe.Message)
	}
	if _, pe := l.admit("k", 0, 2, now); pe == nil {
		t.Fatal("double release freed an extra slot")
	}
	r2()
}

func TestCheckRateLimits(t *testing.T) {
	s, a := newTestServer(t)
	ctx := context.Background()
	key := models.APIKey{ID: "key-1", Name: "test"}
	rpm, tpm := 1, 1000
	plan := &models.Plan{Name: "pro", RPM: &rpm}

	release, err := s.checkRateLimits(ctx, key, plan)
	if err != nil {
		t.Fatalf("first request: %v", err)
	}
	release()
	if _, err := s.checkRateLimits(ctx, key, plan); core.AsProviderError(err).Kind != core.ErrRateLimit {
		t.Fatalf("second request in the minute = %v, want rate limit", err)
	}

	// The settings toggle switches enforcement off.
	exec(t, a, `INSERT INTO settings (key, value) VALUES ('app', '{"enforce_rate_limits":false}')`)
	if _, err := s.checkRateLimits(ctx, key, plan); err != nil {
		t.Fatalf("enforcement off must admit: %v", err)
	}
	exec(t, a, `UPDATE settings SET value = '{"enforce_rate_limits":true}' WHERE key = 'app'`)

	// TPM counts this key's tokens over the last minute.
	tpmPlan := &models.Plan{Name: "tpm", TPM: &tpm}
	other := models.APIKey{ID: "key-2"}
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, prompt_tokens, completion_tokens, created_at)
		VALUES ('key-2', 'openai', 'gpt-4o', 800, 200, ?)`, time.Now().UTC())
	if _, err := s.checkRateLimits(ctx, other, tpmPlan); core.AsProviderError(err).Kind != core.ErrRateLimit {
		t.Fatalf("1000 tokens in the last minute = %v, want rate limit", err)
	}
	if _, err := s.checkRateLimits(ctx, models.APIKey{ID: "key-3"}, tpmPlan); err != nil {
		t.Fatalf("a key without usage must pass TPM: %v", err)
	}

	// No plan, or a plan without limits, is never limited.
	if _, err := s.checkRateLimits(ctx, key, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := s.checkRateLimits(ctx, key, &models.Plan{}); err != nil {
		t.Fatal(err)
	}
}
