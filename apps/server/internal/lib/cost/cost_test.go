package cost_test

import (
	"testing"

	"tera-router/server/internal/lib/cost"
)

// Worked examples use dollars-per-million straight into micros: a $3/M output
// rate is OutputMicros 3_000_000, so tokens×micros/1e6 lands on whole dollars.

func TestMicrosBillsFullCompletionWithoutReasoningRate(t *testing.T) {
	// $2/M input, $3/M output: 1M input + 500k completion = $2 + $1.50.
	rates := cost.Rates{InputMicros: 2_000_000, OutputMicros: 3_000_000}
	got := cost.Micros(rates, 1_000_000, 0, 0, 500_000, 200_000)
	if got != 3_500_000 {
		t.Fatalf("Micros() = %d, want 3_500_000 (reasoning tokens must not change billing when no reasoning rate is set)", got)
	}
}

func TestMicrosSplitsCompletionWhenReasoningRateSet(t *testing.T) {
	// $3/M output, $1/M reasoning: (600k-200k)×$3 + 200k×$1 = $1.20 + $0.20.
	rates := cost.Rates{OutputMicros: 3_000_000, ReasoningMicros: 1_000_000}
	got := cost.Micros(rates, 0, 0, 0, 600_000, 200_000)
	if got != 1_400_000 {
		t.Fatalf("Micros() = %d, want 1_400_000", got)
	}
}

func TestMicrosClampsReasoningAboveCompletion(t *testing.T) {
	// An upstream reporting more reasoning than completion must not produce a
	// negative completion bill: 0×$3 + 500×$1 = $0.0005.
	rates := cost.Rates{OutputMicros: 3_000_000, ReasoningMicros: 1_000_000}
	got := cost.Micros(rates, 0, 0, 0, 100, 500)
	if got != 500 {
		t.Fatalf("Micros() = %d, want 500", got)
	}
}

func TestMicrosSplitBillsAllTokenClasses(t *testing.T) {
	// $2/M input, $1/M cache read, $2.50/M cache write, $3/M output, $1/M
	// reasoning over 1M prompt (300k cached, 100k cache-written) and 600k
	// completion (100k reasoning): $1.20 + $0.30 + $0.25 + $1.50 + $0.10.
	rates := cost.Rates{
		InputMicros:      2_000_000,
		OutputMicros:     3_000_000,
		CacheReadMicros:  1_000_000,
		CacheWriteMicros: 2_500_000,
		ReasoningMicros:  1_000_000,
	}
	got := cost.Micros(rates, 1_000_000, 300_000, 100_000, 600_000, 100_000)
	if got != 3_350_000 {
		t.Fatalf("Micros() = %d, want 3_350_000", got)
	}
}

func TestMicrosClampsCachedAbovePrompt(t *testing.T) {
	// A negative standard-input remainder is clamped to zero (never credited),
	// but the cache-read tokens still bill at their own rate: 400×$1/M = $0.0004.
	rates := cost.Rates{InputMicros: 2_000_000, CacheReadMicros: 1_000_000}
	got := cost.Micros(rates, 100, 400, 0, 0, 0)
	if got != 400 {
		t.Fatalf("Micros() = %d, want 400", got)
	}
}

func TestMicrosZeroRatesCostNothing(t *testing.T) {
	rates := cost.Rates{ReasoningMicros: 0}
	got := cost.Micros(rates, 1_000_000, 0, 0, 1_000_000, 500_000)
	if got != 0 {
		t.Fatalf("Micros() = %d, want 0", got)
	}
}

func TestRatesZeroAccountsForReasoning(t *testing.T) {
	if (cost.Rates{ReasoningMicros: 5}).Zero() {
		t.Fatal("Rates{ReasoningMicros: 5}.Zero() = true, want false")
	}
	if !(cost.Rates{}.Zero()) {
		t.Fatal("Rates{}.Zero() = false, want true")
	}
}
