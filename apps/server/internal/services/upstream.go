package services

import (
	"bytes"
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

	"tera-router/server/internal/connectors"
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

// setUpstreamAuth sets the auth headers for an upstream credential: the
// Anthropic dialect uses x-api-key, or Bearer plus the oauth beta header when
// the credential is an OAuth access token; every other dialect uses Bearer.
func setUpstreamAuth(req *http.Request, anthropic bool, oauth bool, apiKey string) {
	if !anthropic {
		req.Header.Set("Authorization", "Bearer "+apiKey)
		return
	}
	if oauth {
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("anthropic-beta", connectors.AnthropicOAuthBeta)
	} else {
		req.Header.Set("x-api-key", apiKey)
	}
	req.Header.Set("anthropic-version", connectors.AnthropicVersion)
}

// V1Join resolves a path against an OpenAI/Anthropic base URL, avoiding the
// /v1/v1 double when the base already ends in /v1.
func V1Join(base, path string) string {
	base = strings.TrimSuffix(base, "/")
	if strings.HasSuffix(base, "/v1") {
		return base + "/" + strings.TrimLeft(path, "/")
	}
	return base + "/v1/" + strings.TrimLeft(path, "/")
}

// looksLikeHTML reports whether a response is an HTML document rather than
// the JSON the model-list endpoints answer with: an explicit text/html
// Content-Type, or a body whose first non-whitespace byte is '<' (catches
// servers that omit or mislabel the content type). JSON never starts with '<'.
func looksLikeHTML(body []byte, contentType string) bool {
	if ct, _, _ := strings.Cut(contentType, ";"); strings.EqualFold(strings.TrimSpace(ct), "text/html") {
		return true
	}
	trimmed := bytes.TrimSpace(body)
	return len(trimmed) > 0 && trimmed[0] == '<'
}

// ProbeCredential performs a lightweight authenticated GET against the
// provider's model-list endpoint to verify a credential before it is stored.
// The caller decides the endpoint and wire dialect; oauth marks a credential
// that is an OAuth access token rather than an API key.
func (s *UpstreamService) ProbeCredential(ctx context.Context, endpoint string, anthropicDialect, oauth bool, apiKey string) (dtos.TestResult, error) {
	if err := validateEndpoint(endpoint); err != nil {
		return dtos.TestResult{OK: false, Detail: err.Error()}, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return dtos.TestResult{}, err
	}
	setUpstreamAuth(req, anthropicDialect, oauth, apiKey)

	start := time.Now()
	client := probeClient()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return dtos.TestResult{OK: false, LatencyMS: latency, Detail: err.Error()}, nil
	}
	defer resp.Body.Close()
	sniff, _ := io.ReadAll(io.LimitReader(resp.Body, 512))

	result := dtos.TestResult{Status: resp.StatusCode, LatencyMS: latency}
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		// A base_url pointing at a website instead of the API root usually
		// answers 200 with an HTML soft-404, which used to read as "accepted".
		if looksLikeHTML(sniff, resp.Header.Get("Content-Type")) {
			result.Detail = "endpoint returned an HTML page instead of JSON; check that base_url points to the API endpoint, not a website"
			return result, nil
		}
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
// endpoint using the given credential; oauth marks an OAuth access token
// rather than an API key. Both wire dialects answer with the same
// {"data":[{"id":...}]} shape; the ids come back sorted for a stable listing.
// When an entry carries a pricing object (the OpenRouter convention some
// OpenAI-compatible upstreams follow), its rates are parsed too.
func (s *UpstreamService) ListModels(ctx context.Context, endpoint string, anthropicDialect, oauth bool, apiKey string) ([]UpstreamModel, error) {
	if err := validateEndpoint(endpoint); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	setUpstreamAuth(req, anthropicDialect, oauth, apiKey)

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
	// The most common wrong-base_url failure mode: a website (or the SPA in
	// front of a gateway) soft-404s /v1/models with a 200 HTML page, which a
	// plain JSON error cannot distinguish from a malformed API answer.
	if looksLikeHTML(body, resp.Header.Get("Content-Type")) {
		return nil, fmt.Errorf("upstream returned an HTML page instead of a JSON model list (status %d); check that base_url points to the API endpoint, not a website", resp.StatusCode)
	}

	var payload struct {
		Data []struct {
			ID      string                     `json:"id"`
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
	var p UpstreamPricing
	var inputOK, outputOK bool
	p.InputMicros, inputOK = usdPerTokenToMicros(raw["prompt"])
	p.OutputMicros, outputOK = usdPerTokenToMicros(raw["completion"])
	if !inputOK && !outputOK {
		return nil
	}
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

// ollamaAPIBase strips the OpenAI-compatible "/v1" suffix an Ollama base URL
// carries, returning the daemon origin the native /api surface hangs off.
func ollamaAPIBase(baseURL string) string {
	base := strings.TrimSuffix(baseURL, "/")
	return strings.TrimSuffix(base, "/v1")
}

// ProbeOpenRouterKey validates an OpenRouter API key against /api/v1/key —
// the one authenticated endpoint that answers 401 on a bad key — and reports
// the key's usage/limit when the provider returns them.
func (s *UpstreamService) ProbeOpenRouterKey(ctx context.Context, baseURL, apiKey string) (dtos.TestResult, error) {
	endpoint := strings.TrimSuffix(baseURL, "/") + "/key"
	if err := validateEndpoint(endpoint); err != nil {
		return dtos.TestResult{OK: false, Detail: err.Error()}, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return dtos.TestResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	start := time.Now()
	client := probeClient()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return dtos.TestResult{OK: false, LatencyMS: latency, Detail: err.Error()}, nil
	}
	defer resp.Body.Close()

	result := dtos.TestResult{Status: resp.StatusCode, LatencyMS: latency}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		result.Detail = "credential rejected by provider"
		return result, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		result.Detail = fmt.Sprintf("upstream responded with status %d", resp.StatusCode)
		return result, nil
	}

	var payload struct {
		Data struct {
			Label      string   `json:"label"`
			Usage      *float64 `json:"usage"`
			Limit      *float64 `json:"limit"`
			IsFreeTier bool     `json:"is_free_tier"`
		} `json:"data"`
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err == nil {
		_ = json.Unmarshal(body, &payload)
	}

	result.OK = true
	detail := "credential accepted"
	if payload.Data.Label != "" {
		detail += " · " + payload.Data.Label
	}
	if payload.Data.Usage != nil {
		detail += fmt.Sprintf(" · usage $%.4f", *payload.Data.Usage)
	}
	if payload.Data.Limit != nil && *payload.Data.Limit > 0 {
		detail += fmt.Sprintf(" of $%.2f", *payload.Data.Limit)
	}
	result.Detail = detail
	return result, nil
}

// ListOllamaModels fetches Ollama's native /api/tags model list (both Ollama
// Cloud and a local daemon answer it; the key is optional and only sent when
// set). Model ids are the tags' bare names.
func (s *UpstreamService) ListOllamaModels(ctx context.Context, baseURL, apiKey string) ([]UpstreamModel, error) {
	endpoint := ollamaAPIBase(baseURL) + "/api/tags"
	if err := validateEndpoint(endpoint); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
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
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parse ollama tags response: %w", err)
	}

	models := make([]UpstreamModel, 0, len(payload.Models))
	for _, m := range payload.Models {
		if m.Name == "" {
			continue
		}
		models = append(models, UpstreamModel{ID: m.Name})
	}
	slices.SortFunc(models, func(a, b UpstreamModel) int { return strings.Compare(a.ID, b.ID) })
	return models, nil
}

// ListClineModels fetches the Cline model catalog: the union of the standard
// OpenAI-compatible GET {base}/models response and the free-promotion list
// from GET {base}/ai/cline/recommended-models (whose `free` array carries the
// no-cost tier). Both upstream calls are best-effort — only when both fail and
// nothing was collected does the refresh error. Requests carry the Cline SDK's
// identification headers; the key needs the workos: prefix its gateway
// expects.
func (s *UpstreamService) ListClineModels(ctx context.Context, baseURL, apiKey string) ([]UpstreamModel, error) {
	base := strings.TrimSuffix(baseURL, "/")
	if apiKey != "" && !strings.HasPrefix(apiKey, "workos:") && !strings.HasPrefix(apiKey, "sk_") {
		apiKey = "workos:" + apiKey
	}
	do := func(endpoint string, recommended bool) ([]UpstreamModel, error) {
		if err := validateEndpoint(endpoint); err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		if apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		req.Header.Set("User-Agent", "Cline/1.0.0")
		req.Header.Set("Accept", "application/json")

		resp, err := probeClient().Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		if err != nil {
			return nil, err
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("GET %s returned %d", endpoint, resp.StatusCode)
		}
		if recommended {
			var free struct {
				Free []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"free"`
			}
			if err := json.Unmarshal(body, &free); err != nil {
				return nil, fmt.Errorf("parse recommended-models response: %w", err)
			}
			out := make([]UpstreamModel, 0, len(free.Free))
			for _, e := range free.Free {
				if e.ID != "" {
					out = append(out, UpstreamModel{ID: e.ID})
				}
			}
			return out, nil
		}
		var env struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &env); err != nil {
			return nil, fmt.Errorf("parse models response: %w", err)
		}
		out := make([]UpstreamModel, 0, len(env.Data))
		for _, e := range env.Data {
			if e.ID != "" {
				out = append(out, UpstreamModel{ID: e.ID})
			}
		}
		return out, nil
	}

	standard, errStandard := do(base+"/models", false)
	free, errFree := do(base+"/ai/cline/recommended-models", true)

	seen := map[string]bool{}
	out := make([]UpstreamModel, 0, len(standard)+len(free))
	for _, m := range append(standard, free...) {
		if m.ID == "" || seen[m.ID] {
			continue
		}
		seen[m.ID] = true
		out = append(out, m)
	}
	if len(out) == 0 && errStandard != nil && errFree != nil {
		return nil, fmt.Errorf("both /models and recommended-models failed: %v; %v", errStandard, errFree)
	}
	slices.SortFunc(out, func(a, b UpstreamModel) int { return strings.Compare(a.ID, b.ID) })
	return out, nil
}

// modelTestMaxTokens caps the completion length of a dashboard model test so
// a single probe stays cheap even on expensive models.
const modelTestMaxTokens = 1024

// chatCompletionClient sends one-shot test completions: no redirects (the
// same pivot protection as probeClient) with a much longer timeout, since a
// real completion can take tens of seconds where a credential probe cannot.
func chatCompletionClient() *http.Client {
	return &http.Client{
		Timeout: 90 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

// ChatCompletion sends one small chat completion to the upstream to verify a
// model actually answers — the dashboard's model test. The caller resolves
// the base URL, wire dialect, and credential exactly like the gateway would;
// oauth marks an OAuth access token rather than an API key.
// Upstream failures (non-2xx, unparseable body, empty answer) are reported in
// the result rather than as a Go error, so the dashboard can render the
// reason inline; only context/transport setup problems return an error.
func (s *UpstreamService) ChatCompletion(ctx context.Context, baseURL string, anthropicDialect, oauth bool, apiKey, model string, messages []dtos.ModelTestMessage) (dtos.ModelTestResult, error) {
	endpoint := strings.TrimSuffix(baseURL, "/") + "/chat/completions"
	if anthropicDialect {
		endpoint = V1Join(baseURL, "messages")
	}
	if err := validateEndpoint(endpoint); err != nil {
		return dtos.ModelTestResult{OK: false, Detail: err.Error()}, nil
	}

	msgs := make([]map[string]string, 0, len(messages))
	for _, m := range messages {
		msgs = append(msgs, map[string]string{"role": m.Role, "content": m.Content})
	}
	payload := map[string]any{"model": model, "max_tokens": modelTestMaxTokens, "messages": msgs}
	switch {
	case !anthropicDialect:
		payload["stream"] = false
	case oauth:
		payload["system"] = connectors.ClaudeCodeSystemPrompt
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return dtos.ModelTestResult{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return dtos.ModelTestResult{}, err
	}
	setUpstreamAuth(req, anthropicDialect, oauth, apiKey)
	req.Header.Set("Content-Type", "application/json")

	start := time.Now()
	resp, err := chatCompletionClient().Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return dtos.ModelTestResult{OK: false, LatencyMS: latency, Model: model, Detail: err.Error()}, nil
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return dtos.ModelTestResult{OK: false, LatencyMS: latency, Model: model, Detail: "read upstream response: " + err.Error()}, nil
	}

	result := dtos.ModelTestResult{Status: resp.StatusCode, LatencyMS: latency, Model: model}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		result.Detail = upstreamErrorMessage(raw, resp.StatusCode)
		return result, nil
	}

	if anthropicDialect {
		var parsed struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
			Usage struct {
				InputTokens  int64 `json:"input_tokens"`
				OutputTokens int64 `json:"output_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			result.Detail = "parse upstream response: " + err.Error()
			return result, nil
		}
		var text strings.Builder
		for _, block := range parsed.Content {
			if block.Type == "text" && block.Text != "" {
				if text.Len() > 0 {
					text.WriteString("\n")
				}
				text.WriteString(block.Text)
			}
		}
		result.Content = text.String()
		result.InputTokens = parsed.Usage.InputTokens
		result.OutputTokens = parsed.Usage.OutputTokens
	} else {
		var parsed struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
			Usage struct {
				PromptTokens     int64 `json:"prompt_tokens"`
				CompletionTokens int64 `json:"completion_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			result.Detail = "parse upstream response: " + err.Error()
			return result, nil
		}
		if len(parsed.Choices) > 0 {
			result.Content = parsed.Choices[0].Message.Content
		}
		result.InputTokens = parsed.Usage.PromptTokens
		result.OutputTokens = parsed.Usage.CompletionTokens
	}

	if result.Content == "" {
		result.Detail = "upstream returned an empty completion"
		return result, nil
	}
	result.OK = true
	return result, nil
}

// upstreamErrorMessage extracts a human-readable reason from an upstream
// error body: both wire dialects nest it under error.message, some upstreams
// put a plain string under error, and the truncated raw body is the fallback
// so an HTML error page still says something.
func upstreamErrorMessage(raw []byte, status int) string {
	var probe struct {
		Error json.RawMessage `json:"error"`
	}
	if json.Unmarshal(raw, &probe) == nil && len(probe.Error) > 0 {
		var nested struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(probe.Error, &nested) == nil && nested.Message != "" {
			return nested.Message
		}
		var flat string
		if json.Unmarshal(probe.Error, &flat) == nil && flat != "" {
			return flat
		}
	}
	detail := strings.TrimSpace(string(raw))
	if len(detail) > 300 {
		detail = detail[:300] + "…"
	}
	if detail == "" {
		return fmt.Sprintf("upstream responded with status %d", status)
	}
	return detail
}
