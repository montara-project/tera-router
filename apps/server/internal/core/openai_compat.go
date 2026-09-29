package core

import "strings"

// IsOpenAINewerMaxTokensFamily reports whether a model id belongs to an
// OpenAI model family that now accepts only `max_completion_tokens` on the
// chat completions endpoint and rejects the legacy `max_tokens` field with
// HTTP 400 (see https://github.com/decolua/9router/issues/1745 and
// https://platform.openai.com/docs/guides/migration).
//
// The covered families are:
//
//   - The gpt-5 family: "gpt-5", "gpt-5-mini", "gpt-5.4-mini",
//     "gpt-5.4-nano", "GPT-5", ... — anything that starts with "gpt-5"
//     followed by end-of-string, '-', or '.'.
//   - The o-series: "o1", "o1-mini", "o1-preview", "o3", "o3-mini",
//     "o4-mini", ... — anything that starts with "o" followed by a single
//     digit and then end-of-string, '-', or '.'.
//
// The check is provider-agnostic. Those identifiers only exist on OpenAI's
// own API surface, so any chat request whose Model matches is guaranteed to
// land on OpenAI's chat completions endpoint where the legacy key is
// rejected. This lets the normalizer and the per-provider renderer share a
// single source of truth for the model-name rule.
//
// Conservative: model names that merely start with "gpt-50", "gpt-500",
// "o10", "o11" or similar are NOT matched, so a still-legacy model is
// never silently reclassified.
func IsOpenAINewerMaxTokensFamily(model string) bool {
	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		return false
	}
	if strings.HasPrefix(m, "gpt-5") {
		// "gpt-5" must be followed by end-of-string, '-', or '.' so a
		// hypothetical "gpt-50" is NOT matched. "gpt-5-mini" and
		// "gpt-5.4-mini" are both valid gpt-5.x variants.
		rest := m[len("gpt-5"):]
		if rest == "" || rest[0] == '-' || rest[0] == '.' {
			return true
		}
		return false
	}
	if len(m) >= 2 && m[0] == 'o' && m[1] >= '0' && m[1] <= '9' {
		// o1, o3, o4, o5, ... but only when followed by end-of-string,
		// '-', or '.' so "o10", "o11", "o100" are NOT matched. Plain "o"
		// (length 1) is also rejected.
		if len(m) == 2 {
			return true
		}
		next := m[2]
		return next == '-' || next == '.'
	}
	return false
}
