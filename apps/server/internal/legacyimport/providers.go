package legacyimport

import "strings"

// target is where a 9router/OmniRoute provider id lands in Tera Router.
type target struct {
	// slug is the Tera Router provider slug accounts and chain steps use.
	slug string
	// custom marks a provider that does not exist in the built-in catalog and
	// must be created as a custom provider from name/baseURL/apiKind.
	custom  bool
	name    string
	baseURL string
	apiKind string
	// oauth marks subscription providers whose credential is the OAuth token
	// pair rather than an API key.
	oauth bool
}

// catalogTargets maps source provider ids onto built-in catalog providers.
// Claude Code (claude) is Anthropic's OAuth subscription, which Tera Router
// drives through the anthropic provider.
var catalogTargets = map[string]target{
	"openai":        {slug: "openai"},
	"anthropic":     {slug: "anthropic"},
	"openrouter":    {slug: "openrouter"},
	"nvidia":        {slug: "nvidia"},
	"cline":         {slug: "cline"},
	"cloudflare-ai": {slug: "cloudflare"},
	"claude":        {slug: "anthropic", oauth: true},
	"codex":         {slug: "codex", oauth: true},
}

// compatible lists source API-key providers that speak an OpenAI- or
// Anthropic-compatible chat API at a fixed endpoint, so their keys keep
// working as a Tera Router custom provider (slug = source id). Base URLs are
// the provider endpoints with the per-request path (/chat/completions,
// /messages) removed, which the gateway appends itself.
var compatible = map[string]target{
	"agnes":             {name: "Agnes AI", baseURL: "https://apihub.agnes-ai.com/v1"},
	"alicode":           {name: "Alibaba Coding", baseURL: "https://coding.dashscope.aliyuncs.com/v1"},
	"alicode-intl":      {name: "Alibaba Coding (Intl)", baseURL: "https://coding-intl.dashscope.aliyuncs.com/v1"},
	"alims-intl":        {name: "Alibaba Model Studio (Intl)", baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"},
	"alitp-intl":        {name: "Alibaba Token Plan (Intl)", baseURL: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"},
	"api-airforce":      {name: "API Airforce", baseURL: "https://api.airforce/v1"},
	"atria":             {name: "Atria", baseURL: "https://api.atria-asi.ai/v1"},
	"bai":               {name: "B.AI", baseURL: "https://api.b.ai/v1"},
	"baidu":             {name: "Baidu Qianfan", baseURL: "https://qianfan.baidubce.com/v2"},
	"bazaarlink":        {name: "BazaarLink", baseURL: "https://bazaarlink.ai/api/v1"},
	"blackbox":          {name: "Blackbox AI", baseURL: "https://api.blackbox.ai/v1"},
	"bluesminds":        {name: "BluesMinds", baseURL: "https://api.bluesminds.com/v1"},
	"byteplus":          {name: "BytePlus", baseURL: "https://ark.ap-southeast.bytepluses.com/api/coding/v3"},
	"cerebras":          {name: "Cerebras", baseURL: "https://api.cerebras.ai/v1"},
	"chutes":            {name: "Chutes", baseURL: "https://llm.chutes.ai/v1"},
	"cohere":            {name: "Cohere", baseURL: "https://api.cohere.ai/v1"},
	"dahl":              {name: "Dahl", baseURL: "https://inference.dahl.global/v1"},
	"deepseek":          {name: "DeepSeek", baseURL: "https://api.deepseek.com"},
	"featherless":       {name: "Featherless", baseURL: "https://api.featherless.ai/v1"},
	"fireworks":         {name: "Fireworks AI", baseURL: "https://api.fireworks.ai/inference/v1"},
	"gemini":            {name: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai"},
	"glm-cn":            {name: "GLM (China)", baseURL: "https://open.bigmodel.cn/api/coding/paas/v4"},
	"groq":              {name: "Groq", baseURL: "https://api.groq.com/openai/v1"},
	"hyperbolic":        {name: "Hyperbolic", baseURL: "https://api.hyperbolic.xyz/v1"},
	"kilo-gateway":      {name: "Kilo Gateway", baseURL: "https://api.kilo.ai/api/gateway"},
	"kimchi":            {name: "Kimchi", baseURL: "https://llm.kimchi.dev/openai/v1"},
	"llm7":              {name: "LLM7", baseURL: "https://api.llm7.io/v1"},
	"mistral":           {name: "Mistral AI", baseURL: "https://api.mistral.ai/v1"},
	"morph":             {name: "Morph", baseURL: "https://api.morphllm.com/v1"},
	"nebius":            {name: "Nebius AI Studio", baseURL: "https://api.studio.nebius.ai/v1"},
	"opencode-go":       {name: "OpenCode Go", baseURL: "https://opencode.ai/zen/go/v1"},
	"opencode-zen":      {name: "OpenCode Zen", baseURL: "https://opencode.ai/zen/v1"},
	"perplexity":        {name: "Perplexity", baseURL: "https://api.perplexity.ai"},
	"poolside":          {name: "Poolside", baseURL: "https://inference.poolside.ai/v1"},
	"sambanova":         {name: "SambaNova", baseURL: "https://api.sambanova.ai/v1"},
	"siliconflow":       {name: "SiliconFlow", baseURL: "https://api.siliconflow.com/v1"},
	"tencent":           {name: "Tencent Hunyuan", baseURL: "https://api.hunyuan.cloud.tencent.com/v1"},
	"together":          {name: "Together AI", baseURL: "https://api.together.xyz/v1"},
	"tokenharbor":       {name: "TokenHarbor", baseURL: "https://tokenharbor.ai/v1"},
	"tokenrouter":       {name: "TokenRouter", baseURL: "https://api.tokenrouter.com/v1"},
	"venice":            {name: "Venice AI", baseURL: "https://api.venice.ai/api/v1"},
	"vercel-ai-gateway": {name: "Vercel AI Gateway", baseURL: "https://ai-gateway.vercel.sh/v1"},
	"volcengine-ark":    {name: "Volcengine Ark", baseURL: "https://ark.cn-beijing.volces.com/api/coding/v3"},
	"xai":               {name: "xAI", baseURL: "https://api.x.ai/v1"},
	"xiaomi-tokenplan":  {name: "Xiaomi MiMo Token Plan", baseURL: "https://token-plan-sgp.xiaomimimo.com/v1"},

	"glm":        {name: "Z.AI GLM", baseURL: "https://api.z.ai/api/anthropic/v1", apiKind: "anthropic"},
	"kimi":       {name: "Kimi Coding", baseURL: "https://api.kimi.com/coding/v1", apiKind: "anthropic"},
	"minimax":    {name: "MiniMax", baseURL: "https://api.minimax.io/anthropic/v1", apiKind: "anthropic"},
	"minimax-cn": {name: "MiniMax (China)", baseURL: "https://api.minimaxi.com/anthropic/v1", apiKind: "anthropic"},
}

// sourceAliases maps the short provider aliases 9router uses inside model
// strings ("cc/claude-sonnet-4") onto provider ids. Ids whose alias equals
// the id are omitted.
var sourceAliases = map[string]string{
	"cc":      "claude",
	"cx":      "codex",
	"cl":      "cline",
	"af":      "api-airforce",
	"bzl":     "bazaarlink",
	"bm":      "bluesminds",
	"qianfan": "baidu",
	"samba":   "sambanova",
	"hunyuan": "tencent",
	"ocz":     "opencode-zen",
	"kgw":     "kilo-gateway",
}

// knownTarget resolves a source provider id (or alias) onto its target.
func knownTarget(id string) (target, bool) {
	id = strings.TrimSpace(id)
	if alias, ok := sourceAliases[id]; ok {
		id = alias
	}
	if t, ok := catalogTargets[id]; ok {
		return t, true
	}
	if t, ok := compatible[id]; ok {
		t.slug = id
		t.custom = true
		if t.apiKind == "" {
			t.apiKind = "openai"
		}
		return t, true
	}
	return target{}, false
}

// nodeTarget turns a compatible node into a custom provider target.
func nodeTarget(n Node, slugify func(string) string) target {
	kind := "openai"
	switch {
	case strings.HasPrefix(n.Type, "anthropic") || strings.HasPrefix(n.ID, "anthropic-compatible"):
		kind = "anthropic"
	case strings.EqualFold(n.APIType, "responses"):
		kind = "openai_responses"
	}
	return target{
		slug:    slugify(firstNonEmpty(n.Prefix, n.Name, n.ID)),
		custom:  true,
		name:    firstNonEmpty(n.Name, n.Prefix, n.ID),
		baseURL: normalizeBaseURL(n.BaseURL, kind),
		apiKind: kind,
	}
}

// normalizeBaseURL strips the per-request path a source may store on a base
// URL, since the gateway appends it.
func normalizeBaseURL(base, kind string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	lower := strings.ToLower(base)
	for _, suffix := range []string{"/chat/completions", "/responses", "/messages"} {
		if strings.HasSuffix(lower, suffix) {
			base = base[:len(base)-len(suffix)]
			break
		}
	}
	if kind == "anthropic" && !strings.Contains(strings.ToLower(base), "/v1") {
		base += "/v1"
	}
	return strings.TrimRight(base, "/")
}
