// Package cost converts token usage into micros of USD. It is the single
// source of truth shared by the gateway (which charges a request) and the
// usage dashboard (which re-derives the same numbers from stored rows).
package cost

// Rates are per-million-token prices in micros of USD, so a rate of 2_500_000
// means $2.50 per million tokens.
type Rates struct {
	InputMicros      int64
	OutputMicros     int64
	CacheReadMicros  int64
	CacheWriteMicros int64
	// ReasoningMicros prices the reasoning tokens upstreams report inside
	// their completion count. Zero keeps the whole completion on the output
	// rate; when set, the completion bill splits so the reasoning share is
	// priced at its own rate instead.
	ReasoningMicros int64
}

// Zero reports whether every rate is unset, i.e. the model carries no pricing
// override and its requests cost zero.
func (r Rates) Zero() bool {
	return r.InputMicros == 0 && r.OutputMicros == 0 && r.CacheReadMicros == 0 && r.CacheWriteMicros == 0 && r.ReasoningMicros == 0
}

// Micros returns the cost of one usage event in micros of USD.
//
// Each bucket is `tokens * microsPerMillion / 1_000_000`; the division happens
// once at the end so no per-bucket precision is lost to truncation. Standard
// input tokens are the prompt total minus the tokens served from and written to
// a provider-side cache, because those are billed at their own rates. A
// negative remainder (an upstream reporting more cached tokens than prompt
// tokens) is clamped to zero rather than credited.
//
// Reasoning tokens are a subset of the completion count (both OpenAI dialects
// report them inside completion tokens), so a set ReasoningMicros splits the
// completion bill: completion-minus-reasoning at the output rate, reasoning at
// its own rate. Without a reasoning rate the whole completion stays on the
// output rate — the pre-reasoning behavior.
func Micros(r Rates, prompt, cached, cacheWrite, completion, reasoning int64) int64 {
	standardInput := prompt - cached - cacheWrite
	if standardInput < 0 {
		standardInput = 0
	}

	// Reasoning tokens ride inside the completion bill unless an explicit
	// reasoning rate splits it.
	completionMicros := completion * r.OutputMicros
	if r.ReasoningMicros > 0 {
		standardCompletion := completion - reasoning
		if standardCompletion < 0 {
			standardCompletion = 0
		}
		completionMicros = standardCompletion*r.OutputMicros + reasoning*r.ReasoningMicros
	}

	weighted := standardInput*r.InputMicros +
		cached*r.CacheReadMicros +
		cacheWrite*r.CacheWriteMicros +
		completionMicros
	if weighted <= 0 {
		return 0
	}
	return weighted / 1_000_000
}
