package gateway

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"sync"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// rateWindow is the span RPM and TPM are measured over.
const rateWindow = time.Minute

// keyLimiter enforces a plan's per-key RPM and concurrency in memory.
// ponytail: per-process state; a multi-instance deployment would need a
// shared store (Redis) for limits to hold across instances.
type keyLimiter struct {
	mu       sync.Mutex
	hits     map[string][]time.Time // admitted request times inside rateWindow
	inflight map[string]int
}

func newKeyLimiter() *keyLimiter {
	return &keyLimiter{hits: map[string][]time.Time{}, inflight: map[string]int{}}
}

// admit checks rpm and concurrent for keyID and, when both pass, records the
// request and takes a concurrency slot. Zero or nil limits are unlimited.
func (l *keyLimiter) admit(keyID string, rpm, concurrent int, now time.Time) (func(), *core.ProviderError) {
	l.mu.Lock()
	defer l.mu.Unlock()

	hits := l.hits[keyID]
	cut := 0
	for cut < len(hits) && now.Sub(hits[cut]) >= rateWindow {
		cut++
	}
	hits = hits[cut:]

	if rpm > 0 && len(hits) >= rpm {
		l.hits[keyID] = hits
		return nil, rateLimited(fmt.Sprintf("rate limit reached: %d requests per minute for this API key", rpm), hits[0].Add(rateWindow).Sub(now))
	}
	if concurrent > 0 && l.inflight[keyID] >= concurrent {
		l.hits[keyID] = hits
		return nil, rateLimited(fmt.Sprintf("rate limit reached: %d concurrent requests for this API key", concurrent), time.Second)
	}

	if rpm > 0 {
		hits = append(hits, now)
	}
	if len(hits) == 0 {
		delete(l.hits, keyID)
	} else {
		l.hits[keyID] = hits
	}
	if concurrent <= 0 {
		return func() {}, nil
	}
	l.inflight[keyID]++
	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			defer l.mu.Unlock()
			if l.inflight[keyID]--; l.inflight[keyID] <= 0 {
				delete(l.inflight, keyID)
			}
		})
	}, nil
}

func rateLimited(msg string, retry time.Duration) *core.ProviderError {
	if retry < time.Second {
		retry = time.Second
	}
	return &core.ProviderError{Kind: core.ErrRateLimit, Message: msg, RetryAfter: retry}
}

// checkRateLimits applies the key's plan RPM, TPM and concurrency when the
// operator enabled "Enforce API key rate limits". On success the returned
// release frees the concurrency slot and must be called once the request is
// done; on a limit it returns an ErrRateLimit carrying Retry-After.
func (s *Server) checkRateLimits(ctx context.Context, key models.APIKey, plan *models.Plan) (func(), error) {
	noop := func() {}
	if plan == nil {
		return noop, nil
	}
	rpm, tpm, concurrent := limitValue(plan.RPM), limitValue(plan.TPM), limitValue(plan.Concurrent)
	if rpm == 0 && tpm == 0 && concurrent == 0 {
		return noop, nil
	}
	settings, err := s.loadAppSettings(ctx)
	if err != nil {
		return noop, err
	}
	if settings.EnforceRateLimits != nil && !*settings.EnforceRateLimits {
		return noop, nil
	}

	now := time.Now()
	if tpm > 0 {
		// Tokens are only known once a request finishes, so TPM counts the
		// raw tokens this key's finished requests used in the last minute.
		// ponytail: requests already in flight are not counted; pair TPM with
		// a concurrency cap when bursts matter.
		used, err := s.app.Repos.Usage.SumSince(ctx, models.ScopeAPIKey, key.ID, now.Add(-rateWindow))
		if err != nil {
			return noop, err
		}
		if used.PromptTokens+used.CompletionTokens >= int64(tpm) {
			return noop, rateLimited(fmt.Sprintf("rate limit reached: %d tokens per minute for this API key", tpm), rateWindow)
		}
	}
	release, pe := s.keyLimits.admit(key.ID, rpm, concurrent, now)
	if pe != nil {
		return noop, pe
	}
	return release, nil
}

func limitValue(v *int) int {
	if v == nil || *v < 0 {
		return 0
	}
	return *v
}

// setRetryAfter writes the Retry-After header (whole seconds, rounded up).
func setRetryAfter(c fiber.Ctx, d time.Duration) {
	if d > 0 {
		c.Set("Retry-After", strconv.Itoa(int(math.Ceil(d.Seconds()))))
	}
}
