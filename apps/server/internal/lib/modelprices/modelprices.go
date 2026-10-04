// Package modelprices holds the compiled-in per-model retail rates the meter
// and the usage dashboard fall back to when no operator override exists. It is
// ported from the IDRouter reference (connectors/model_prices.go): override →
// built-in table → zero, so every known model shows pricing on the Usage page
// without manual setup. Operator rows in model_pricing_overrides always win.
// Reasoning rates split the completion bill the same way the reference does:
// when a model reports reasoning tokens inside its completion count, those
// tokens price at ReasoningMicros instead of the output rate.
//
// Rates reuse the shared cost.Rates units: micros of USD per million tokens.
package modelprices

import "tera-router/server/internal/lib/cost"

// entry is one compiled-in model price. Providers carries every provider slug
// that serves the model at these rates (e.g. the OpenAI price card also backs
// the "codex" OAuth provider, which is the same upstream).
type entry struct {
	providers []string
	model     string
	rates     cost.Rates
}

// usd converts dollars-per-million-tokens into whole micros, rounding instead
// of truncating: 0.01875 USD/million is 18750 micros, not 18749.
func usd(perMillion float64) int64 {
	return int64(perMillion*1_000_000 + 0.5)
}

func rates(in, out, cacheRead, cacheWrite float64) cost.Rates {
	return cost.Rates{
		InputMicros:      usd(in),
		OutputMicros:     usd(out),
		CacheReadMicros:  usd(cacheRead),
		CacheWriteMicros: usd(cacheWrite),
	}
}

// reasoning returns r with the reasoning rate set (USD per million tokens).
// Zero — the default from rates — bills the whole completion at the output
// rate, so only the handful of models with a separate reasoning price need
// this wrapper.
func reasoning(r cost.Rates, perMillion float64) cost.Rates {
	r.ReasoningMicros = usd(perMillion)
	return r
}

// table is keyed by provider + "\x00" + model, matching the pricing-key
// encoding used by the meter and the telemetry handlers.
var table = buildTable()

func buildTable() map[string]cost.Rates {
	entries := []entry{
		// OpenAI — cache write = standard input (no separate charge).
		// The "codex" OAuth provider serves the same upstream models.
		{[]string{"openai", "codex"}, "gpt-5", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-5-mini", rates(0.4, 1.6, 0.2, 0.4)},
		{[]string{"openai", "codex"}, "gpt-5-nano", rates(0.1, 0.4, 0.05, 0.1)},
		{[]string{"openai", "codex"}, "gpt-5.4", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-5.4-mini", rates(0.4, 1.6, 0.2, 0.4)},
		{[]string{"openai", "codex"}, "gpt-5.3-codex", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-4o", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-4o-2024-11-20", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-4o-2024-08-06", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openai", "codex"}, "gpt-4o-mini", rates(0.15, 0.6, 0.075, 0.15)},
		{[]string{"openai", "codex"}, "gpt-4o-mini-2024-07-18", rates(0.15, 0.6, 0.075, 0.15)},
		// o-series reasoning tokens bill at the output rate, stated explicitly
		// so a future split keeps the current behavior.
		{[]string{"openai", "codex"}, "o1", reasoning(rates(15, 60, 7.5, 15), 60)},
		{[]string{"openai", "codex"}, "o1-pro", reasoning(rates(150, 600, 75, 150), 600)},
		{[]string{"openai", "codex"}, "o3", reasoning(rates(2, 8, 0.5, 2), 8)},
		{[]string{"openai", "codex"}, "o3-mini", reasoning(rates(1.1, 4.4, 0.55, 1.1), 4.4)},
		{[]string{"openai", "codex"}, "o4-mini", reasoning(rates(1.1, 4.4, 0.275, 1.1), 4.4)},
		// Older models (no prompt caching).
		{[]string{"openai", "codex"}, "gpt-4-turbo", rates(10, 30, 0, 0)},
		{[]string{"openai", "codex"}, "gpt-4", rates(30, 60, 0, 0)},
		{[]string{"openai", "codex"}, "gpt-3.5-turbo", rates(0.5, 1.5, 0, 0)},
		// Embeddings bill input only.
		{[]string{"openai", "codex"}, "text-embedding-3-small", rates(0.02, 0, 0, 0)},
		{[]string{"openai", "codex"}, "text-embedding-3-large", rates(0.13, 0, 0, 0)},
		{[]string{"openai", "codex"}, "text-embedding-ada-002", rates(0.1, 0, 0, 0)},

		// Anthropic — cache write = 1.25x standard input.
		{[]string{"anthropic"}, "claude-sonnet-5", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-opus-4-20250514", rates(15, 75, 1.875, 18.75)},
		{[]string{"anthropic"}, "claude-opus-4-7", rates(15, 75, 1.875, 18.75)},
		{[]string{"anthropic"}, "claude-sonnet-4-20250514", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-sonnet-4-6", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-haiku-4-5-20251001", rates(0.8, 4, 0.08, 1.0)},
		{[]string{"anthropic"}, "claude-3-5-sonnet-20241022", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-3-5-sonnet-latest", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-3-5-haiku-20241022", rates(0.8, 4, 0.08, 1.0)},
		{[]string{"anthropic"}, "claude-3-opus-20240229", rates(15, 75, 1.875, 18.75)},
		{[]string{"anthropic"}, "claude-3-sonnet-20240229", rates(3, 15, 0.375, 3.75)},
		{[]string{"anthropic"}, "claude-3-haiku-20240307", rates(0.25, 1.25, 0.03, 0.3125)},

		// DeepSeek.
		{[]string{"deepseek"}, "deepseek-chat", rates(0.27, 1.1, 0.07, 0.27)},
		{[]string{"deepseek"}, "deepseek-coder", rates(0.27, 1.1, 0.07, 0.27)},
		{[]string{"deepseek"}, "deepseek-reasoner", reasoning(rates(0.55, 2.19, 0.14, 0.55), 2.19)},

		// Gemini — cache write = standard input.
		{[]string{"gemini"}, "gemini-2.5-pro", rates(1.25, 10, 0.3125, 1.25)},
		{[]string{"gemini"}, "gemini-2.5-flash", rates(0.15, 0.6, 0.0375, 0.15)},
		{[]string{"gemini"}, "gemini-2.5-flash-lite", rates(0.075, 0.3, 0.01875, 0.075)},
		{[]string{"gemini"}, "gemini-2.0-flash", rates(0.1, 0.4, 0.025, 0.1)},
		{[]string{"gemini"}, "gemini-2.0-flash-lite", rates(0.075, 0.3, 0.01875, 0.075)},
		{[]string{"gemini"}, "gemini-1.5-pro", rates(1.25, 5, 0.3125, 1.25)},
		{[]string{"gemini"}, "gemini-1.5-flash", rates(0.075, 0.3, 0.01875, 0.075)},

		// Groq (whisper is free).
		{[]string{"groq"}, "llama-3.3-70b-versatile", rates(0.59, 0.79, 0, 0)},
		{[]string{"groq"}, "llama-3.1-8b-instant", rates(0.05, 0.08, 0, 0)},
		{[]string{"groq"}, "mixtral-8x7b-32768", rates(0.24, 0.24, 0, 0)},
		{[]string{"groq"}, "gemma2-9b-it", rates(0.2, 0.2, 0, 0)},
		{[]string{"groq"}, "whisper-large-v3", rates(0, 0, 0, 0)},
		{[]string{"groq"}, "whisper-large-v3-turbo", rates(0, 0, 0, 0)},

		// Mistral.
		{[]string{"mistral"}, "mistral-large-latest", rates(2, 6, 0, 0)},
		{[]string{"mistral"}, "mistral-small-latest", rates(0.1, 0.3, 0, 0)},
		{[]string{"mistral"}, "codestral-latest", rates(0.3, 0.9, 0, 0)},
		{[]string{"mistral"}, "pixtral-large-latest", rates(2, 6, 0, 0)},

		// xAI.
		{[]string{"xai"}, "grok-3", rates(3, 15, 0.75, 3)},
		{[]string{"xai"}, "grok-3-fast", rates(5, 25, 1.25, 5)},
		{[]string{"xai"}, "grok-3-mini", reasoning(rates(0.3, 0.5, 0.075, 0.3), 0.5)},
		{[]string{"xai"}, "grok-2", rates(2, 10, 0.5, 2)},

		// Perplexity.
		{[]string{"perplexity"}, "sonar-pro", rates(3, 15, 0, 0)},
		{[]string{"perplexity"}, "sonar", rates(1, 1, 0, 0)},
		{[]string{"perplexity"}, "sonar-reasoning-pro", rates(2, 8, 0, 0)},
		{[]string{"perplexity"}, "sonar-deep-research", rates(2, 8, 0, 0)},

		// Cohere.
		{[]string{"cohere"}, "command-r-plus", rates(2.5, 10, 0, 0)},
		{[]string{"cohere"}, "command-r", rates(0.15, 0.6, 0, 0)},

		// NVIDIA NIM.
		{[]string{"nvidia"}, "meta/llama-3.1-405b-instruct", rates(1, 1, 0, 0)},
		{[]string{"nvidia"}, "meta/llama-3.1-70b-instruct", rates(0.13, 0.13, 0, 0)},
		{[]string{"nvidia"}, "nvidia/llama-3.1-nemotron-70b-instruct", rates(0.13, 0.13, 0, 0)},

		// OpenRouter — pass-through with typical markups; exact prices vary.
		{[]string{"openrouter"}, "anthropic/claude-opus-4-7", rates(15, 75, 1.875, 18.75)},
		{[]string{"openrouter"}, "anthropic/claude-sonnet-4-6", rates(3, 15, 0.375, 3.75)},
		{[]string{"openrouter"}, "openai/gpt-5", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openrouter"}, "openai/gpt-4o", rates(2.5, 10, 1.25, 2.5)},
		{[]string{"openrouter"}, "openai/gpt-4o-mini", rates(0.15, 0.6, 0.075, 0.15)},
		{[]string{"openrouter"}, "deepseek/deepseek-chat", rates(0.27, 1.1, 0.07, 0.27)},
		{[]string{"openrouter"}, "google/gemini-2.5-pro", rates(1.25, 10, 0.3125, 1.25)},
		{[]string{"openrouter"}, "google/gemini-2.5-flash", rates(0.15, 0.6, 0.0375, 0.15)},
		{[]string{"openrouter"}, "meta-llama/llama-3.3-70b-instruct", rates(0.1, 0.1, 0, 0)},

		// MiniMax.
		{[]string{"minimax"}, "MiniMax-Text-01", rates(0.2, 1.1, 0, 0)},
		{[]string{"minimax"}, "MiniMax-M1", reasoning(rates(0.2, 1.1, 0, 0), 1.1)},
		{[]string{"minimax"}, "MiniMax-M2.5", rates(0.3, 1.1, 0, 0)},
		{[]string{"minimax"}, "MiniMax-M3", reasoning(rates(0.4, 1.6, 0, 0), 1.6)},

		// GLM.
		{[]string{"glm"}, "glm-4-plus", rates(0.6, 0.6, 0, 0)},
		{[]string{"glm"}, "glm-4-flash", rates(0, 0, 0, 0)},
		{[]string{"glm"}, "codegeex-4", rates(0.6, 0.6, 0, 0)},
	}

	// Kiro is subscription/credit-based rather than per-token, so its rates
	// are retail-equivalent estimates of the underlying model, surfaced so
	// usage statistics can display an approximate cost. The recorded model id
	// keeps the synthetic suffixes (-thinking, -agentic), so each base model
	// expands into every variant at the same rate.
	sonnet := rates(3.0, 15.0, 0.375, 3.75)
	opus := rates(15.0, 75.0, 1.875, 18.75)
	kiroBases := []struct {
		model string
		r     cost.Rates
	}{
		{"claude-sonnet-4.5", sonnet},
		{"claude-sonnet-4.6", sonnet},
		{"claude-sonnet-4.7", sonnet},
		{"claude-sonnet-4.8", sonnet},
		{"claude-opus-4.6", opus},
		{"claude-opus-4.7", opus},
		{"claude-opus-4.8", opus},
		{"claude-haiku-4.5", rates(0.8, 4.0, 0.08, 1.0)},
		{"deepseek-3.2", rates(0.27, 1.1, 0.07, 0.27)},
		{"glm-5", rates(0.6, 2.2, 0, 0)},
		{"MiniMax-M2.5", rates(0.3, 1.1, 0, 0)},
		{"qwen3-coder-next", rates(0.3, 1.2, 0, 0)},
	}
	kiroSuffixes := []string{"", "-thinking", "-agentic", "-thinking-agentic"}
	for _, base := range kiroBases {
		for _, sfx := range kiroSuffixes {
			entries = append(entries, entry{[]string{"kiro"}, base.model + sfx, base.r})
		}
	}
	// "auto" maps to Sonnet rates as a neutral default (Kiro picks server-side).
	entries = append(entries,
		entry{[]string{"kiro"}, "auto", sonnet},
		entry{[]string{"kiro"}, "auto-thinking", sonnet},
	)

	out := make(map[string]cost.Rates, len(entries))
	for _, e := range entries {
		for _, provider := range e.providers {
			out[provider+"\x00"+e.model] = e.rates
		}
	}
	return out
}

// Lookup returns the compiled-in rates for one provider/model pair, or false
// when the model is unknown (it stays unpriced: self-hosted and free-tier
// endpoints cost zero by design).
func Lookup(provider, model string) (cost.Rates, bool) {
	if provider == "" || model == "" {
		return cost.Rates{}, false
	}
	r, ok := table[provider+"\x00"+model]
	return r, ok
}
