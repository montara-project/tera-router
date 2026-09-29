package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

// target is one candidate destination for a request: a concrete provider slug
// plus the upstream model id to send it.
type target struct {
	Provider string
	Model    string
	// Alias is the model alias the request resolved through, or "" when the
	// request named a provider/model pair directly. It is echoed back to the
	// client as the response model so callers see the name they sent.
	Alias string
	// ChainName is the chain the target came from, or "" for direct targets.
	// It is kept for logging and access-policy attribution.
	ChainName string
}

// resolveResult is the outcome of turning an inbound model string into an
// ordered attempt list.
type resolveResult struct {
	Targets []target
	// Strategy is the chain's rotation strategy ("priority", "round-robin",
	// "load-balanced"). Empty for direct targets.
	Strategy string
	// ChainName is the resolved chain name ("" when the request did not
	// resolve to a chain). Set for both "chain:name" and a bare chain name so
	// access policies cannot be bypassed by dropping the prefix.
	ChainName string
	// EchoModel is the model name echoed back to the client: the alias name
	// when the request resolved through an alias, otherwise the requested
	// model id.
	EchoModel string
}

// badModelError marks an unresolvable model string — a client error (400),
// not a router fault.
type badModelError struct{ msg string }

func (e badModelError) Error() string { return e.msg }

func errBadModel(msg string) error { return badModelError{msg} }

// resolveTargets turns an inbound model string into an ordered fallback chain.
//
// Four forms are supported, in priority order:
//
//   - "chain:<name>"    — the named routing chain's steps.
//   - exact alias match — checked before provider/model parsing so an alias
//     named "vendor/model" wins over the provider/model interpretation.
//   - "provider/model"  — a single explicit target. Slashes beyond the first
//     stay in the model id, so vendor-namespaced ids survive.
//   - bare "name"       — a chain by that name, then an alias by that name.
//     A bare name is never assumed to be a provider model; routing stays
//     explicit.
//
// The provider half of "provider/model" must be either a built-in catalog slug
// or an enabled custom provider slug. Anything else is rejected with 400
// rather than being sent upstream as a typo'd endpoint.
func (s *Server) resolveTargets(ctx context.Context, model string) (resolveResult, error) {
	model = strings.TrimSpace(model)
	if model == "" {
		return resolveResult{}, errBadModel("model is required")
	}

	if name, ok := strings.CutPrefix(model, "chain:"); ok {
		res, err := s.chainResult(ctx, name)
		if err != nil {
			return resolveResult{}, err
		}
		// The client asked for "chain:<name>", so that is the name echoed back.
		res.EchoModel = model
		return res, nil
	}

	// Exact alias match, before provider/model parsing.
	if res, ok := s.aliasResult(ctx, model); ok {
		return res, nil
	}

	// provider/model.
	if provider, rest, ok := strings.Cut(model, "/"); ok && provider != "" && rest != "" {
		if _, routable := s.providerSpec(ctx, provider); !routable {
			return resolveResult{}, errBadModel("unknown provider: " + provider)
		}
		return resolveResult{
			Targets:   []target{{Provider: provider, Model: rest}},
			EchoModel: model,
		}, nil
	}

	// bare name -> chain, then alias.
	if res, err := s.chainResult(ctx, model); err == nil {
		return res, nil
	}
	if res, ok := s.aliasResult(ctx, model); ok {
		return res, nil
	}

	return resolveResult{}, errBadModel("unknown model: " + model)
}

// aliasResult resolves an exact alias name to its active targets, ordered by
// position. It reports ok=false when no active alias of that name exists.
func (s *Server) aliasResult(ctx context.Context, name string) (resolveResult, bool) {
	alias, err := s.app.Repos.Aliases.GetByName(ctx, name)
	if err != nil || !alias.Active {
		return resolveResult{}, false
	}

	out := make([]target, 0, len(alias.Targets))
	for _, t := range alias.Targets {
		if !t.Active {
			continue
		}
		if t.Provider == "" || t.Model == "" {
			continue
		}
		out = append(out, target{Provider: t.Provider, Model: t.Model, Alias: name})
	}
	if len(out) == 0 {
		return resolveResult{}, false
	}
	return resolveResult{Targets: out, EchoModel: name, Strategy: "priority"}, true
}

// chainResult resolves a chain by name. A missing, disabled, or stepless chain
// is a bad-model error so the caller can fall through (bare names) or 400.
func (s *Server) chainResult(ctx context.Context, name string) (resolveResult, error) {
	chain, err := s.app.Repos.Chains.GetByName(ctx, name)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return resolveResult{}, errBadModel("no chain named " + name)
		}
		return resolveResult{}, err
	}
	if !chain.Enabled {
		return resolveResult{}, errBadModel("chain is disabled: " + name)
	}

	out := make([]target, 0, len(chain.Steps)+1)
	for _, step := range chain.Steps {
		if step.Provider == "" || step.Model == "" {
			continue
		}
		out = append(out, target{Provider: step.Provider, Model: step.Model, ChainName: chain.Name})
	}
	// The configured fallback model is appended as the last-resort target.
	if chain.FallbackProvider != "" && chain.FallbackModel != "" {
		out = append(out, target{
			Provider:  chain.FallbackProvider,
			Model:     chain.FallbackModel,
			ChainName: chain.Name,
		})
	}
	if len(out) == 0 {
		return resolveResult{}, errBadModel("chain has no steps: " + name)
	}

	res := resolveResult{
		Targets:   out,
		Strategy:  normalizeStrategy(chain.Strategy),
		ChainName: chain.Name,
		EchoModel: name,
	}
	if res.Strategy == strategyRoundRobin {
		s.rotation.rotate(chain.Name, res.Targets)
	}
	return res, nil
}

// Chain rotation strategies.
const (
	strategyPriority   = "priority"
	strategyRoundRobin = "round-robin"
	strategyLoadBal    = "load-balanced"
)

// normalizeStrategy canonicalizes a stored chain strategy token.
func normalizeStrategy(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "round-robin", "round_robin", "roundrobin":
		return strategyRoundRobin
	case "load-balanced", "load_balanced", "loadbalanced":
		return strategyLoadBal
	default:
		return strategyPriority
	}
}

// rotationState holds a per-chain round-robin cursor. Rotation is deliberately
// in-memory: it only shapes load, and restarting the process resets it to the
// first target, which is a harmless rebalancing.
type rotationState struct {
	mu      sync.Mutex
	cursors map[string]int
}

func newRotationState() rotationState {
	return rotationState{cursors: make(map[string]int)}
}

// rotate reorders targets in place so the request starts at the chain's
// current cursor, then advances the cursor for the next request.
func (r *rotationState) rotate(chain string, targets []target) {
	if len(targets) <= 1 {
		return
	}
	r.mu.Lock()
	cursor := r.cursors[chain] % len(targets)
	r.cursors[chain] = (cursor + 1) % len(targets)
	r.mu.Unlock()

	rotated := make([]target, len(targets))
	for i := range targets {
		rotated[i] = targets[(cursor+i)%len(targets)]
	}
	copy(targets, rotated)
}

// providerSpec describes how to reach a provider upstream.
type providerSpec struct {
	// Slug is the provider identifier used in targets, accounts, and usage.
	Slug string
	// Dialect is the upstream wire format. Empty means the provider is not
	// routable (its catalog entry is account-management only).
	Dialect core.Dialect
	// BaseURL is the provider's default endpoint; an account-level base_url
	// overrides it.
	BaseURL string
	// AuthKind is the default auth mechanism ("api_key", "oauth", "none").
	AuthKind string
}

// providerSpec resolves a provider slug to its upstream spec. Built-in catalog
// providers win over custom providers; a disabled custom provider is treated
// as unknown so it is never routed to.
func (s *Server) providerSpec(ctx context.Context, slug string) (providerSpec, bool) {
	if cp, ok := catalog.Lookup(slug); ok {
		return providerSpec{
			Slug:     cp.Slug,
			Dialect:  catalogDialect(cp.Dialect),
			BaseURL:  cp.BaseURL,
			AuthKind: cp.AuthKind,
		}, true
	}

	custom, err := s.app.Repos.Providers.GetBySlug(ctx, slug)
	if err != nil || !custom.Enabled {
		return providerSpec{}, false
	}
	return providerSpec{
		Slug:     custom.Slug,
		Dialect:  customProviderDialect(custom.APIKind),
		BaseURL:  custom.BaseURL,
		AuthKind: "api_key",
	}, true
}

// catalogDialect maps a catalog dialect string onto a core dialect. An empty
// or unrecognized value yields "" (not routable).
func catalogDialect(d string) core.Dialect {
	switch d {
	case string(core.DialectOpenAI):
		return core.DialectOpenAI
	case string(core.DialectAnthropic):
		return core.DialectAnthropic
	case string(core.DialectOpenAIResponses):
		return core.DialectOpenAIResponses
	default:
		return ""
	}
}

// customProviderDialect maps an operator-set api_kind onto a core dialect.
// Anything that is not explicitly Anthropic or Responses is OpenAI-compatible,
// which is what "custom OpenAI-compatible provider" means.
func customProviderDialect(apiKind string) core.Dialect {
	switch strings.ToLower(strings.TrimSpace(apiKind)) {
	case "anthropic":
		return core.DialectAnthropic
	case "openai_responses", "responses":
		return core.DialectOpenAIResponses
	default:
		return core.DialectOpenAI
	}
}

// applyModelSuffix folds a trailing reasoning hint in the model name — e.g.
// "gpt-5(high)" or "claude(8192)" — into the canonical reasoning config and
// strips it from the id, so the literal "(high)" never travels upstream as
// part of the model name (which providers reject with 404).
//
// An explicit client-supplied Reasoning always wins; the suffix only fills in
// intent the client did not otherwise express.
func applyModelSuffix(req *core.ChatRequest) {
	if req == nil || req.Model == "" {
		return
	}
	bare, level, budget := parseModelSuffix(req.Model)
	if bare == req.Model {
		return
	}
	req.Model = bare
	if req.Reasoning != nil && (req.Reasoning.Effort != "" || req.Reasoning.MaxTokens > 0) {
		return
	}
	if rc := reasoningFrom(level, budget); rc != nil {
		req.Reasoning = rc
	}
}

// applyTargetSuffixes strips a reasoning suffix from each resolved target's
// model id and folds the first found intent into req.Reasoning (only when the
// client did not already express reasoning). An alias target or chain step can
// carry a literal "(high)" that would otherwise 404 upstream.
func applyTargetSuffixes(req *core.ChatRequest, targets []target) {
	if len(targets) == 0 {
		return
	}
	alreadySet := req != nil && req.Reasoning != nil && (req.Reasoning.Effort != "" || req.Reasoning.MaxTokens > 0)
	for i := range targets {
		bare, level, budget := parseModelSuffix(targets[i].Model)
		if bare == targets[i].Model {
			continue
		}
		targets[i].Model = bare
		if req == nil || alreadySet {
			continue
		}
		if rc := reasoningFrom(level, budget); rc != nil {
			req.Reasoning = rc
			alreadySet = true
		}
	}
}

// reasoningFrom builds a ReasoningConfig from a parsed suffix intent, or nil
// when the suffix carried neither an effort nor a budget.
func reasoningFrom(level string, budget int) *core.ReasoningConfig {
	rc := &core.ReasoningConfig{}
	if budget > 0 {
		rc.MaxTokens = budget
	}
	if level != "" {
		rc.Effort = level
	}
	if rc.Effort == "" && rc.MaxTokens == 0 {
		return nil
	}
	return rc
}

// Effort levels and their thinking budgets, mirroring the web-standard values
// the Anthropic/Gemini docs use.
var levelToBudget = map[string]int{
	"none":    0,
	"minimal": 512,
	"low":     1024,
	"medium":  8192,
	"high":    24576,
	"xhigh":   32768,
	"max":     128000,
}

// normalizeEffort canonicalizes a free-form effort word. Unknown values return
// "" so the caller decides the default.
func normalizeEffort(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "none", "off", "disabled":
		return "none"
	case "minimal":
		return "minimal"
	case "low":
		return "low"
	case "medium", "med":
		return "medium"
	case "high":
		return "high"
	case "xhigh", "x-high", "extra-high":
		return "xhigh"
	case "max", "maximum":
		return "max"
	default:
		return ""
	}
}

// budgetToLevel maps a numeric thinking budget onto the nearest discrete
// effort level. Returns "" for a non-positive budget.
func budgetToLevel(budget int) string {
	switch {
	case budget <= 0:
		return ""
	case budget <= 768:
		return "minimal"
	case budget <= 4096:
		return "low"
	case budget <= 16384:
		return "medium"
	case budget <= 28672:
		return "high"
	default:
		return "xhigh"
	}
}

// parseModelSuffix extracts a reasoning override encoded in a model name's
// trailing parenthesized segment: "model(high)", "model(8192)", "model(none)".
// It returns the bare model id plus the effort level and/or explicit budget the
// suffix implies. Without a recognized suffix the model is returned unchanged
// with zero overrides.
func parseModelSuffix(model string) (bare string, level string, budget int) {
	bare = model
	open := strings.LastIndexByte(model, '(')
	if open < 0 || !strings.HasSuffix(model, ")") {
		return bare, "", 0
	}
	inner := strings.TrimSpace(model[open+1 : len(model)-1])
	if inner == "" {
		return bare, "", 0
	}
	candidate := strings.TrimSpace(model[:open])
	if candidate == "" {
		return bare, "", 0
	}
	if n, err := parseInt(inner); err == nil {
		if n < 0 {
			return bare, "", 0
		}
		return candidate, budgetToLevel(n), n
	}
	if lvl := normalizeEffort(inner); lvl != "" {
		return candidate, lvl, levelToBudget[lvl]
	}
	return bare, "", 0
}

// parseInt is a tiny strict decimal parser (no signs, no underscores) so a
// suffix like "(+5)" or "(1_000)" is not mistaken for a budget.
func parseInt(s string) (int, error) {
	if s == "" {
		return 0, errors.New("empty")
	}
	n := 0
	for i := range len(s) {
		c := s[i]
		if c < '0' || c > '9' {
			return 0, errors.New("not a number")
		}
		n = n*10 + int(c-'0')
		if n > 1<<30 {
			return 0, errors.New("overflow")
		}
	}
	return n, nil
}

// detectClient identifies the calling tool from the User-Agent, used for
// telemetry. Best-effort: an unrecognized agent falls back to its product
// token, then to "unknown", so every request stays attributable.
func detectClient(c fiber.Ctx) string {
	ua := strings.ToLower(c.Get("User-Agent"))
	switch {
	case strings.Contains(ua, "claude"):
		return "claude-code"
	case strings.Contains(ua, "cursor"):
		return "cursor"
	case strings.Contains(ua, "codex"):
		return "codex"
	case strings.Contains(ua, "cline"):
		return "cline"
	case strings.Contains(ua, "copilot"):
		return "copilot"
	case strings.Contains(ua, "kilo"):
		return "kilo-code"
	case strings.Contains(ua, "opencode"):
		return "opencode"
	case strings.Contains(ua, "aider"):
		return "aider"
	case strings.Contains(ua, "roo"):
		return "roo-code"
	}
	if label := normalizeClientLabel(ua); label != "" {
		return label
	}
	if lang := strings.TrimSpace(c.Get("x-stainless-lang")); lang != "" {
		return "sdk-" + sanitizeClientToken(strings.ToLower(lang))
	}
	return "unknown"
}

// normalizeClientLabel extracts a stable client label from a User-Agent by
// taking the leading product token, lowercased and stripped of noise. Returns
// "" for generic HTTP libraries that carry no product identity, and for an
// empty agent.
func normalizeClientLabel(ua string) string {
	ua = strings.ToLower(strings.TrimSpace(ua))
	if ua == "" {
		return ""
	}
	token := ua
	if i := strings.IndexAny(token, "/ \t"); i >= 0 {
		token = token[:i]
	}
	token = sanitizeClientToken(token)
	switch token {
	case "", "mozilla", "python-requests", "python", "go-http-client",
		"node-fetch", "axios", "curl", "okhttp", "java", "undici":
		return ""
	}
	return token
}

// sanitizeClientToken keeps only [a-z0-9-_.] and trims separators so labels are
// safe to store and group on. Input is lowercased, so callers need not
// normalize first.
func sanitizeClientToken(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9',
			r == '-', r == '_', r == '.':
			b.WriteRune(r)
		}
	}
	return strings.Trim(b.String(), "-_.")
}

// estimateInputTokens approximates a prompt's token count with the common
// ~4 chars/token rule over system text, message content, tool-call arguments,
// tool results, and tool definitions. It backs /v1/messages/count_tokens,
// which is served locally because most OpenAI-dialect upstreams have no
// equivalent endpoint.
func estimateInputTokens(req *core.ChatRequest) int {
	if req == nil {
		return 0
	}
	chars := len(req.System)
	for _, m := range req.Messages {
		for _, part := range m.Content {
			chars += len(part.Text)
			if part.ToolCall != nil {
				chars += len(part.ToolCall.Arguments)
			}
			if part.ToolResult != nil {
				chars += len(part.ToolResult.Content)
			}
		}
	}
	for _, t := range req.Tools {
		chars += len(t.Name) + len(t.Description) + len(t.Parameters)
	}
	if chars <= 0 {
		return 0
	}
	return (chars + 3) / 4
}

// accountMetadata is the subset of an account's metadata JSON the gateway
// honors: an endpoint override and extra upstream headers.
type accountMetadata struct {
	BaseURL string            `json:"base_url"`
	Headers map[string]string `json:"headers"`
}

// parseAccountMetadata decodes an account's raw metadata JSON. Malformed JSON
// yields an empty metadata rather than failing the account.
func parseAccountMetadata(raw string) accountMetadata {
	if strings.TrimSpace(raw) == "" {
		return accountMetadata{}
	}
	var meta accountMetadata
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return accountMetadata{}
	}
	return meta
}
