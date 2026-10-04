package gateway

import (
	"net/http"
	"testing"

	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/cost"
)

func TestParseModelSuffix(t *testing.T) {
	cases := []struct {
		in         string
		wantBare   string
		wantLevel  string
		wantBudget int
	}{
		{"gpt-4o", "gpt-4o", "", 0},
		{"gpt-5(high)", "gpt-5", "high", 24576},
		{"gpt-5(xhigh)", "gpt-5", "xhigh", 32768},
		{"claude(8192)", "claude", "medium", 8192},
		{"claude(0)", "claude", "", 0},
		{"claude(none)", "claude", "none", 0},
		{"claude(off)", "claude", "none", 0},
		{"vendor/model(high)", "vendor/model", "high", 24576},
		// Unrecognized suffixes leave the id intact.
		{"gpt-4o(turbo)", "gpt-4o(turbo)", "", 0},
		{"gpt-4o()", "gpt-4o()", "", 0},
		{"(high)", "(high)", "", 0},
		// Not a suffix at all.
		{"gpt-4o(high", "gpt-4o(high", "", 0},
		{"gpt-4o high)", "gpt-4o high)", "", 0},
		// Strict numeric parse: a sign or separator is not a budget.
		{"claude(+5)", "claude(+5)", "", 0},
		{"claude(1_000)", "claude(1_000)", "", 0},
		// Only the trailing group is considered.
		{"a(b)c", "a(b)c", "", 0},
		{"a(b)(high)", "a(b)", "high", 24576},
	}

	for _, tc := range cases {
		bare, level, budget := parseModelSuffix(tc.in)
		if bare != tc.wantBare || level != tc.wantLevel || budget != tc.wantBudget {
			t.Errorf("parseModelSuffix(%q) = (%q, %q, %d), want (%q, %q, %d)",
				tc.in, bare, level, budget, tc.wantBare, tc.wantLevel, tc.wantBudget)
		}
	}
}

func TestApplyModelSuffix(t *testing.T) {
	t.Run("folds suffix into reasoning", func(t *testing.T) {
		req := &core.ChatRequest{Model: "gpt-5(high)"}
		applyModelSuffix(req)
		if req.Model != "gpt-5" {
			t.Errorf("model = %q, want gpt-5", req.Model)
		}
		if req.Reasoning == nil || req.Reasoning.Effort != "high" {
			t.Errorf("reasoning = %+v, want effort high", req.Reasoning)
		}
	})

	t.Run("explicit reasoning wins", func(t *testing.T) {
		req := &core.ChatRequest{
			Model:     "gpt-5(low)",
			Reasoning: &core.ReasoningConfig{Effort: "high"},
		}
		applyModelSuffix(req)
		if req.Model != "gpt-5" {
			t.Errorf("model = %q, want the suffix stripped regardless", req.Model)
		}
		if req.Reasoning.Effort != "high" {
			t.Errorf("effort = %q, want the client's high preserved", req.Reasoning.Effort)
		}
	})

	t.Run("no suffix is a no-op", func(t *testing.T) {
		req := &core.ChatRequest{Model: "gpt-4o"}
		applyModelSuffix(req)
		if req.Model != "gpt-4o" || req.Reasoning != nil {
			t.Errorf("got model=%q reasoning=%+v", req.Model, req.Reasoning)
		}
	})
}

func TestApplyTargetSuffixes(t *testing.T) {
	req := &core.ChatRequest{Model: "smart"}
	targets := []target{
		{Provider: "openai", Model: "gpt-5(high)"},
		{Provider: "anthropic", Model: "claude(low)"},
	}
	applyTargetSuffixes(req, targets)

	if targets[0].Model != "gpt-5" || targets[1].Model != "claude" {
		t.Errorf("suffixes not stripped: %+v", targets)
	}
	// The first suffixed target wins; the second must not overwrite it.
	if req.Reasoning == nil || req.Reasoning.Effort != "high" {
		t.Errorf("reasoning = %+v, want high from the first target", req.Reasoning)
	}
}

func TestEstimateInputTokens(t *testing.T) {
	if got := estimateInputTokens(nil); got != 0 {
		t.Errorf("nil request = %d, want 0", got)
	}

	req := &core.ChatRequest{
		System: "12345678", // 8 chars
		Messages: []core.Message{
			{Role: core.RoleUser, Content: []core.ContentPart{
				{Type: core.PartText, Text: "12345678"}, // 8
			}},
			{Role: core.RoleAssistant, Content: []core.ContentPart{
				{Type: core.PartToolCall, ToolCall: &core.ToolCall{Arguments: []byte(`{"a":1}`)}}, // 7
			}},
			{Role: core.RoleTool, Content: []core.ContentPart{
				{Type: core.PartToolResult, ToolResult: &core.ToolResult{Content: "1234"}}, // 4
			}},
		},
		Tools: []core.Tool{{Name: "t", Description: "dd", Parameters: []byte(`{}`)}}, // 5
	}
	// 8 + 8 + 7 + 4 + 5 = 32 chars -> (32+3)/4 = 8 tokens.
	if got := estimateInputTokens(req); got != 8 {
		t.Errorf("estimateInputTokens = %d, want 8", got)
	}
}

func TestCostMicros(t *testing.T) {
	rates := cost.Rates{
		InputMicros:      3_000_000, // $3.00 / M
		OutputMicros:     15_000_000,
		CacheReadMicros:  300_000,
		CacheWriteMicros: 3_750_000,
	}

	cases := []struct {
		name  string
		usage core.Usage
		want  int64
	}{
		{
			name:  "plain input and output",
			usage: core.Usage{PromptTokens: 1_000_000, CompletionTokens: 1_000_000},
			// 1M * 3.00 + 1M * 15.00 = 18.00 -> 18_000_000 micros
			want: 18_000_000,
		},
		{
			name:  "cache read is discounted",
			usage: core.Usage{PromptTokens: 1_000_000, CachedTokens: 1_000_000},
			// standard input 0, cache read 1M * 0.30 = 300_000 micros
			want: 300_000,
		},
		{
			name:  "cache write is billed separately",
			usage: core.Usage{PromptTokens: 1_000_000, CacheWriteTokens: 1_000_000},
			// standard input 0, cache write 1M * 3.75 = 3_750_000 micros
			want: 3_750_000,
		},
		{
			name:  "mixed prompt splits into three buckets",
			usage: core.Usage{PromptTokens: 1_000_000, CachedTokens: 400_000, CacheWriteTokens: 100_000, CompletionTokens: 0},
			// standard 500_000 * 3.00 = 1_500_000
			// cached   400_000 * 0.30 =   120_000
			// write    100_000 * 3.75 =   375_000
			want: 1_995_000,
		},
		{
			name:  "cached tokens exceeding prompt clamp to zero input",
			usage: core.Usage{PromptTokens: 100, CachedTokens: 500},
			// standard input would be -400 -> clamped to 0; 500 * 0.30 = 150
			want: 150,
		},
		{
			name:  "zero usage costs nothing",
			usage: core.Usage{},
			want:  0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := costMicros(rates, tc.usage); got != tc.want {
				t.Errorf("costMicros = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestCostMicrosUnpricedModelIsFree(t *testing.T) {
	if got := costMicros(cost.Rates{}, core.Usage{PromptTokens: 1_000_000, CompletionTokens: 1_000_000}); got != 0 {
		t.Errorf("cost = %d, want 0 for an unpriced model", got)
	}
}

func TestMergeUsage(t *testing.T) {
	// Anthropic splits accounting: input at message start, output at the end.
	var acc core.Usage
	acc.Merge(core.Usage{PromptTokens: 100})
	acc.Merge(core.Usage{CompletionTokens: 50})
	if acc.PromptTokens != 100 || acc.CompletionTokens != 50 {
		t.Errorf("merged = %+v, want both fields retained", acc)
	}
	if acc.TotalTokens != 150 {
		t.Errorf("total = %d, want 150", acc.TotalTokens)
	}

	// A later non-zero value wins.
	acc.Merge(core.Usage{PromptTokens: 200})
	if acc.PromptTokens != 200 {
		t.Errorf("prompt = %d, want the later 200", acc.PromptTokens)
	}
	// A later zero must not erase an earlier value.
	acc.Merge(core.Usage{PromptTokens: 0})
	if acc.PromptTokens != 200 {
		t.Errorf("prompt = %d, want 200 (zero must not overwrite)", acc.PromptTokens)
	}

	// An explicit total is honored.
	acc.Merge(core.Usage{TotalTokens: 999})
	if acc.TotalTokens != 999 {
		t.Errorf("total = %d, want 999", acc.TotalTokens)
	}
}

func TestStatusForError(t *testing.T) {
	cases := map[core.ErrorKind]int{
		core.ErrBadRequest:        http.StatusBadRequest,
		core.ErrContextTooLarge:   http.StatusBadRequest,
		core.ErrModelNotFound:     http.StatusBadRequest,
		core.ErrToolCallMalformed: http.StatusBadRequest,
		core.ErrAuth:              http.StatusUnauthorized,
		core.ErrRateLimit:         http.StatusTooManyRequests,
		core.ErrCapacity:          http.StatusTooManyRequests,
		core.ErrQuotaExhausted:    http.StatusPaymentRequired,
		core.ErrBudgetBlocked:     http.StatusPaymentRequired,
		core.ErrAccountSuspended:  http.StatusPaymentRequired,
		core.ErrBilling:           http.StatusPaymentRequired,
		core.ErrTimeout:           http.StatusGatewayTimeout,
		core.ErrInternal:          http.StatusInternalServerError,
		core.ErrUpstream:          http.StatusBadGateway,
		core.ErrEmptyResponse:     http.StatusBadGateway,
	}
	for kind, want := range cases {
		pe := &core.ProviderError{Kind: kind}
		if got := statusForError(pe); got != want {
			t.Errorf("statusForError(%q) = %d, want %d", kind, got, want)
		}
	}
}

func TestErrorTypeVocabulary(t *testing.T) {
	cases := map[int]string{
		http.StatusUnauthorized:        "authentication_error",
		http.StatusTooManyRequests:     "rate_limit_error",
		http.StatusBadRequest:          "invalid_request_error",
		http.StatusForbidden:           "invalid_request_error",
		http.StatusInternalServerError: "api_error",
		http.StatusBadGateway:          "api_error",
	}
	for status, want := range cases {
		if got := errorType(status); got != want {
			t.Errorf("errorType(%d) = %q, want %q", status, got, want)
		}
	}
}

func TestAnthropicErrorTypeVocabulary(t *testing.T) {
	cases := map[int]string{
		http.StatusBadRequest:            "invalid_request_error",
		http.StatusUnauthorized:          "authentication_error",
		http.StatusForbidden:             "permission_error",
		http.StatusNotFound:              "not_found_error",
		http.StatusTooManyRequests:       "rate_limit_error",
		http.StatusRequestEntityTooLarge: "request_too_large",
		http.StatusInternalServerError:   "api_error",
	}
	for status, want := range cases {
		if got := anthropicErrorType(status); got != want {
			t.Errorf("anthropicErrorType(%d) = %q, want %q", status, got, want)
		}
	}
}

func TestSanitizeErrorMessage(t *testing.T) {
	t.Run("redacts an sk key but keeps its prefix", func(t *testing.T) {
		msg := "invalid key sk-proj-abcdefghijklmnopqrstuvwxyz123456"
		got := sanitizeErrorMessage(msg)
		if contains(got, "abcdefghijklmnopqrstuvwxyz") {
			t.Errorf("secret survived sanitization: %q", got)
		}
		if !contains(got, "sk-proj") {
			t.Errorf("provider prefix lost: %q", got)
		}
		if !contains(got, "[redacted]") {
			t.Errorf("no redaction marker: %q", got)
		}
	})

	t.Run("redacts a bearer token", func(t *testing.T) {
		msg := "upstream said: Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345 invalid"
		got := sanitizeErrorMessage(msg)
		if contains(got, "abcdefghijklmnopqrstuvwxyz012345") {
			t.Errorf("token survived sanitization: %q", got)
		}
	})

	t.Run("short fragments are left alone", func(t *testing.T) {
		msg := "model sk-123 not found"
		if got := sanitizeErrorMessage(msg); got != msg {
			t.Errorf("got %q, want the message unchanged", got)
		}
	})

	t.Run("caps length", func(t *testing.T) {
		long := make([]byte, 500)
		for i := range long {
			long[i] = 'x'
		}
		got := sanitizeErrorMessage(string(long))
		if len(got) > maxErrorMessageLen+len("…") {
			t.Errorf("len = %d, want <= %d", len(got), maxErrorMessageLen+len("…"))
		}
		if got == string(long) {
			t.Error("expected truncation")
		}
	})

	t.Run("empty stays empty", func(t *testing.T) {
		if got := sanitizeErrorMessage(""); got != "" {
			t.Errorf("got %q, want empty", got)
		}
	})
}

func TestDetectClientAndLabels(t *testing.T) {
	// normalizeClientLabel is the generic fallback: it returns the lowercased
	// leading product token, and "" when there is no product identity (which
	// detectClient renders as "unknown").
	cases := map[string]string{
		"my-cool-cli/2.1":  "my-cool-cli",
		"codex_cli_rs/1.0": "codex_cli_rs",
		"Cursor/0.42":      "cursor",
		"curl/8.4.0":       "",
		"":                 "",
	}
	for ua, want := range cases {
		if got := normalizeClientLabel(ua); got != want {
			t.Errorf("normalizeClientLabel(%q) = %q, want %q", ua, got, want)
		}
	}

	if got := sanitizeClientToken("My Client!! v1"); got != "myclientv1" {
		t.Errorf("sanitizeClientToken = %q, want myclientv1", got)
	}
	if got := sanitizeClientToken("--weird--"); got != "weird" {
		t.Errorf("sanitizeClientToken = %q, want weird (separators trimmed)", got)
	}
}

func contains(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0)
}

func indexOf(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
