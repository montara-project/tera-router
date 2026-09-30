package services

import (
	"encoding/json"
	"testing"
)

func mustRaw(t *testing.T, v string) json.RawMessage {
	t.Helper()
	return json.RawMessage(v)
}

func TestUsdPerTokenToMicros(t *testing.T) {
	cases := []struct {
		raw  string
		want int64
		ok   bool
	}{
		{`"0.0000025"`, 2_500_000, true},  // $2.50 / M tokens (string)
		{`0.00001`, 10_000_000, true},     // $10 / M tokens (number)
		{`"0"`, 0, true},                  // genuinely free
		{`"0.000000125"`, 125_000, true},  // cache-read scale
		{`"free"`, 0, false},              // non-numeric string
		{`"-1"`, 0, false},                // negative is not a price
		{`null`, 0, false},                // absent value
		{`"1e-6"`, 1_000_000, true},       // scientific notation
	}
	for _, tc := range cases {
		got, ok := usdPerTokenToMicros(mustRaw(t, tc.raw))
		if ok != tc.ok {
			t.Errorf("usdPerTokenToMicros(%s) ok = %v, want %v", tc.raw, ok, tc.ok)
			continue
		}
		if ok && got != tc.want {
			t.Errorf("usdPerTokenToMicros(%s) = %d, want %d", tc.raw, got, tc.want)
		}
	}
}

// TestParseUpstreamPricing pins the OpenRouter pricing-object convention some
// OpenAI-compatible upstreams follow on /v1/models entries.
func TestParseUpstreamPricing(t *testing.T) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{
		"prompt": "0.0000025",
		"completion": "0.00001",
		"request": "0",
		"input_cache_read": "0.000000125",
		"input_cache_write": "0.00000125",
		"web_search": 0
	}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	p := parseUpstreamPricing(raw)
	if p == nil {
		t.Fatal("expected pricing to parse")
	}
	want := UpstreamPricing{
		InputMicros:      2_500_000,
		OutputMicros:     10_000_000,
		CacheReadMicros:  125_000,
		CacheWriteMicros: 1_250_000,
	}
	if *p != want {
		t.Errorf("pricing = %+v, want %+v", *p, want)
	}
}

func TestParseUpstreamPricingNil(t *testing.T) {
	if p := parseUpstreamPricing(nil); p != nil {
		t.Errorf("empty pricing = %+v, want nil", p)
	}

	// A pricing object without prompt/completion carries no usable rate for
	// this router's token-based cost model.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{"image": "0.001"}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if p := parseUpstreamPricing(raw); p != nil {
		t.Errorf("image-only pricing = %+v, want nil", p)
	}
}

func TestParseUpstreamPricingToleratesGarbage(t *testing.T) {
	// Non-numeric values must not poison the parse: usable fields survive.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(`{
		"prompt": "0.0000025",
		"completion": "free",
		"input_cache_read": null
	}`), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	p := parseUpstreamPricing(raw)
	if p == nil {
		t.Fatal("expected pricing to parse despite a non-numeric field")
	}
	if p.InputMicros != 2_500_000 {
		t.Errorf("input = %d, want 2500000", p.InputMicros)
	}
	if p.OutputMicros != 0 || p.CacheReadMicros != 0 {
		t.Errorf("unparseable fields must stay zero, got %+v", p)
	}
}
