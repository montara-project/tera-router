package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"tera-router/server/internal/dtos"
)

// UpstreamService performs outbound HTTP against third-party providers and
// proxies. It never touches the database; callers resolve the endpoint and
// hand over the already decrypted credential.
type UpstreamService struct{}

// TestProxy dials a public URL through the given proxy and reports whether
// the proxy answered.
func (s *UpstreamService) TestProxy(ctx context.Context, proxyURL string) (bool, error) {
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return false, fmt.Errorf("invalid proxy url: %w", err)
	}

	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: &http.Transport{Proxy: http.ProxyURL(parsed)},
	}
	resp, err := client.Get("https://www.google.com/generate_204")
	if err != nil {
		return false, nil
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 512))
	return resp.StatusCode < 500, nil
}

// ProbeCredential performs a lightweight authenticated GET against the
// provider's model-list endpoint to verify a credential before it is stored.
// The caller decides the endpoint and wire dialect.
func (s *UpstreamService) ProbeCredential(ctx context.Context, endpoint string, anthropicDialect bool, apiKey string) (dtos.TestResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return dtos.TestResult{}, err
	}
	if anthropicDialect {
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	start := time.Now()
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return dtos.TestResult{OK: false, LatencyMS: latency, Detail: err.Error()}, nil
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 512))

	result := dtos.TestResult{Status: resp.StatusCode, LatencyMS: latency}
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		result.OK = true
		result.Detail = "credential accepted"
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		result.Detail = "credential rejected by provider"
	default:
		result.Detail = fmt.Sprintf("upstream responded with status %d", resp.StatusCode)
	}
	return result, nil
}
