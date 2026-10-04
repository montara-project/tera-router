package modelprices

import "testing"

// The compiled-in table is the pricing fallback for the gateway meter and the
// usage dashboard; the conversions (USD/million → micros) and the provider
// aliases are pinned here.
func TestLookupKnownModels(t *testing.T) {
	cases := []struct {
		name            string
		provider, model string
		input, output   int64
		cacheRead       int64
	}{
		{name: "openai gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", input: 150_000, output: 600_000, cacheRead: 75_000},
		{name: "anthropic sonnet", provider: "anthropic", model: "claude-sonnet-4-6", input: 3_000_000, output: 15_000_000, cacheRead: 300_000},
		{name: "codex oauth alias", provider: "codex", model: "gpt-5.3-codex", input: 1_750_000, output: 14_000_000, cacheRead: 175_000},
		{name: "openrouter prefixed id", provider: "openrouter", model: "openai/gpt-4o-mini", input: 150_000, output: 600_000, cacheRead: 75_000},
		{name: "kiro suffix variant", provider: "kiro", model: "claude-sonnet-4.5-thinking", input: 3_000_000, output: 15_000_000, cacheRead: 300_000},
		{name: "sub-dollar rounding", provider: "gemini", model: "gemini-2.5-flash-lite", input: 100_000, output: 400_000, cacheRead: 10_000},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, ok := Lookup(tc.provider, tc.model)
			if !ok {
				t.Fatalf("Lookup(%q, %q) = not found", tc.provider, tc.model)
			}
			if r.InputMicros != tc.input || r.OutputMicros != tc.output || r.CacheReadMicros != tc.cacheRead {
				t.Errorf("rates = %+v, want in=%d out=%d cacheRead=%d", r, tc.input, tc.output, tc.cacheRead)
			}
		})
	}
}

func TestLookupMisses(t *testing.T) {
	cases := [][2]string{
		{"openai", "mystery-model"},
		{"unknown-provider", "gpt-4o"},
		{"", "gpt-4o"},
		{"openai", ""},
	}
	for _, c := range cases {
		if r, ok := Lookup(c[0], c[1]); ok {
			t.Errorf("Lookup(%q, %q) = %+v, want not found", c[0], c[1], r)
		}
	}
}
