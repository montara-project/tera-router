package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"tera-router/server/internal/dtos"
)

// UpstreamModel is one model entry from a provider's model list, with its
// advertised pricing when the upstream publishes one.
type UpstreamModel struct {
	ID string
	// Pricing carries the rates the upstream advertises for the model, or nil
	// when it publishes none.
	Pricing *UpstreamPricing
}

// UpstreamPricing is one model's advertised rates, normalized to micros of
// USD per million tokens (the same unit the pricing overrides store).
type UpstreamPricing struct {
	InputMicros      int64
	OutputMicros     int64
	CacheReadMicros  int64
	CacheWriteMicros int64
}

// UpstreamService performs outbound HTTP against third-party providers and
// proxies. It never touches the database; callers resolve the endpoint and
// hand over the already decrypted credential.
type UpstreamService struct{}

// blockedEndpoints are address ranges that are never a legitimate provider
// endpoint. Link-local covers the cloud metadata services (169.254.169.254,
// fe80::/10) and IPv6 unique-local is the equivalent of RFC1918 space.
//
// Loopback and RFC1918 addresses are deliberately NOT blocked: the provider
// catalog ships self-hosted entries (ollama-local on localhost:11434, vLLM on
// localhost:8000), so an operator must be able to probe those. Callers that
// accept an operator-supplied base_url therefore still allow internal targets
// by design; only the ranges above are rejected outright.
var blockedEndpoints = func() []*net.IPNet {
	cidrs := []string{
		"169.254.0.0/16", // link-local, incl. 169.254.169.254 metadata
		"fe80::/10",      // IPv6 link-local
		"fd00:ec2::254/128",
	}
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic("upstream: bad builtin CIDR " + c)
		}
		nets = append(nets, n)
	}
	return nets
}()

// validateEndpoint rejects outbound URLs that cannot be a real provider:
// non-HTTP(S) schemes (file://, gopher://, …) and link-local/metadata hosts.
func validateEndpoint(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid endpoint url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("unsupported endpoint scheme %q: only http and https are allowed", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("endpoint has no host")
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		// A name that does not resolve cannot be dialed; let the request fail
		// naturally rather than reporting a misleading validation error.
		return nil
	}
	for _, ip := range ips {
		for _, n := range blockedEndpoints {
			if n.Contains(ip) {
				return fmt.Errorf("endpoint host %s resolves to blocked address %s", host, ip)
			}
		}
	}
	return nil
}

// probeClient never follows redirects: an allowed public endpoint must not be
// able to pivot the request onto a blocked internal one.
func probeClient() *http.Client {
	return &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

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
	if err := validateEndpoint(endpoint); err != nil {
		return dtos.TestResult{OK: false, Detail: err.Error()}, nil
	}

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
	client := probeClient()
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

// ListModels fetches the model catalog from the provider's model-list
// endpoint using the given credential. Both wire dialects answer with the
// same {"data":[{"id":...}]} shape; the ids come back sorted for a stable
// listing. When an entry carries a pricing object (the OpenRouter convention
// some OpenAI-compatible upstreams follow), its rates are parsed too.
func (s *UpstreamService) ListModels(ctx context.Context, endpoint string, anthropicDialect bool, apiKey string) ([]UpstreamModel, error) {
	if err := validateEndpoint(endpoint); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if anthropicDialect {
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := probeClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("read upstream response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream responded with status %d", resp.StatusCode)
	}

	var payload struct {
		Data []struct {
			ID      string                 `json:"id"`
			Pricing map[string]json.RawMessage `json:"pricing"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parse upstream model list: %w", err)
	}

	models := make([]UpstreamModel, 0, len(payload.Data))
	for _, m := range payload.Data {
		if m.ID == "" {
			continue
		}
		entry := UpstreamModel{ID: m.ID}
		if p := parseUpstreamPricing(m.Pricing); p != nil {
			entry.Pricing = p
		}
		models = append(models, entry)
	}
	slices.SortFunc(models, func(a, b UpstreamModel) int { return strings.Compare(a.ID, b.ID) })
	return models, nil
}

// parseUpstreamPricing reads the OpenRouter-convention pricing object some
// OpenAI-compatible upstreams attach to /v1/models entries: decimal
// USD-per-token strings (or numbers) under prompt, completion,
// input_cache_read, and input_cache_write. Missing or unparseable fields
// stay zero, and a pricing object without a usable prompt/completion rate
// yields nil so it is treated as unpriced rather than free.
func parseUpstreamPricing(raw map[string]json.RawMessage) *UpstreamPricing {
	if len(raw) == 0 {
		return nil
	}
	if _, hasPrompt := raw["prompt"]; !hasPrompt {
		if _, hasCompletion := raw["completion"]; !hasCompletion {
			return nil
		}
	}

	var p UpstreamPricing
	p.InputMicros, _ = usdPerTokenToMicros(raw["prompt"])
	p.OutputMicros, _ = usdPerTokenToMicros(raw["completion"])
	p.CacheReadMicros, _ = usdPerTokenToMicros(raw["input_cache_read"])
	p.CacheWriteMicros, _ = usdPerTokenToMicros(raw["input_cache_write"])
	return &p
}

// usdPerTokenToMicros converts a USD-per-token decimal into micros of USD per
// million tokens: 0.0000025 USD/token becomes 2_500_000 micros ($2.50/M).
// Non-numeric or negative values report false.
func usdPerTokenToMicros(raw json.RawMessage) (int64, bool) {
	var n json.Number
	if err := json.Unmarshal(raw, &n); err != nil {
		return 0, false
	}
	f, err := n.Float64()
	if err != nil || f < 0 {
		return 0, false
	}
	return int64(math.Round(f * 1e12)), true
}
