export const dialects = [
  {
    name: 'OpenAI Chat Completions',
    endpoint: 'POST /v1/chat/completions',
    description:
      'The de-facto standard. Any OpenAI SDK, LangChain pipeline, Cursor config, or curl script works as-is — just swap the base URL.',
    icon: 'messages',
  },
  {
    name: 'Anthropic Messages',
    endpoint: 'POST /v1/messages',
    description:
      'Native Messages API including /v1/messages/count_tokens, so Claude Code and Anthropic SDKs connect without a shim.',
    icon: 'feather',
  },
  {
    name: 'OpenAI Responses',
    endpoint: 'POST /v1/responses',
    description:
      'The newer Responses API surface for agents and stateful workflows, routed to Responses-native providers like Codex.',
    icon: 'workflow',
  },
] as const

export type ProviderGroup = {
  label: string
  hint: string
  providers: { name: string; initials: string; color: string }[]
}

export const providerGroups: ProviderGroup[] = [
  {
    label: 'API key',
    hint: 'Bring your own key — catalog presets ship the base URL and dialect.',
    providers: [
      { name: 'OpenAI', initials: 'OA', color: '#10a37f' },
      { name: 'Anthropic', initials: 'AN', color: '#d97757' },
      { name: 'Gemini', initials: 'GE', color: '#4285f4' },
      { name: 'DeepSeek', initials: 'DS', color: '#4d6bfe' },
      { name: 'xAI (Grok)', initials: 'X', color: '#e2e8f0' },
      { name: 'GLM', initials: 'GL', color: '#38bdf8' },
      { name: 'Kimi', initials: 'KI', color: '#c084fc' },
      { name: 'MiniMax', initials: 'MM', color: '#fb7185' },
      { name: 'Mistral', initials: 'MI', color: '#fa500f' },
      { name: 'Groq', initials: 'GQ', color: '#f55036' },
      { name: 'Cohere', initials: 'CO', color: '#7bb0a8' },
      { name: 'Perplexity', initials: 'PX', color: '#20b8cd' },
      { name: 'OpenRouter', initials: 'OR', color: '#a78bfa' },
      { name: 'NVIDIA NIM', initials: 'NV', color: '#76b900' },
      { name: 'Azure OpenAI', initials: 'AZ', color: '#38bdf8' },
      { name: 'Ollama Cloud', initials: 'OL', color: '#e2e8f0' },
    ],
  },
  {
    label: 'Subscription / OAuth',
    hint: 'Connect existing coding-plan sessions and route them like any other account.',
    providers: [
      { name: 'Claude Code', initials: 'CC', color: '#d97757' },
      { name: 'OpenAI Codex', initials: 'CX', color: '#10a37f' },
      { name: 'GitHub Copilot', initials: 'GH', color: '#e2e8f0' },
      { name: 'Kilo Code', initials: 'KC', color: '#f59e0b' },
    ],
  },
  {
    label: 'Self-hosted & key-less',
    hint: 'Authenticates by network position — no credentials, no account rows.',
    providers: [
      { name: 'Ollama Local', initials: 'OL', color: '#e2e8f0' },
      { name: 'vLLM', initials: 'VL', color: '#4ade80' },
    ],
  },
  {
    label: 'Custom',
    hint: 'Any OpenAI- or Anthropic-compatible endpoint, with per-account base URLs.',
    providers: [
      { name: 'OpenAI-compatible', initials: 'C+', color: '#4ade80' },
      { name: 'Anthropic-compatible', initials: 'C+', color: '#d97757' },
    ],
  },
]

export const steps = [
  {
    title: 'Connect providers',
    description:
      'Pick from the built-in catalog — API keys, OAuth sessions, or key-less local endpoints. Multiple accounts per provider, each with its own base URL and priority.',
    icon: 'key',
    code: 'openai · anthropic · glm · ollama …',
  },
  {
    title: 'Route with fallback',
    description:
      'Every request enters one endpoint. The planner resolves accounts in priority order, cools down failures, and falls back across accounts and providers automatically.',
    icon: 'route',
    code: 'glm-4.7 → kimi-k2 → claude-sonnet (fallback)',
  },
  {
    title: 'Observe everything',
    description:
      'Token usage is metered per request — including SSE streams — and lands in the admin dashboard: per key, per account, per model.',
    icon: 'chart',
    code: 'GET /admin/usage → per-key analytics',
  },
] as const

export const features = [
  {
    icon: 'layers',
    title: 'Multi-account routing',
    description:
      'Several accounts per provider with priority ordering, cooldowns after failures, and automatic fallback attempts.',
  },
  {
    icon: 'languages',
    title: 'Dialect translation',
    description:
      'The transform engine rewrites between OpenAI Chat, Anthropic Messages, and Responses — request in one dialect, land on another.',
  },
  {
    icon: 'list-checks',
    title: 'Per-key allowlists',
    description:
      'Every gateway key can be restricted to specific models, so a teammate or agent only reaches what it should.',
  },
  {
    icon: 'shield',
    title: 'Guardrails',
    description:
      'A policy engine screens requests before traffic leaves your box — your rules, enforced centrally.',
  },
  {
    icon: 'gauge',
    title: 'Usage metering',
    description:
      'Per-request token accounting (streaming included) feeding per-key, per-account, per-model analytics.',
  },
  {
    icon: 'radio',
    title: 'Streaming first',
    description:
      'SSE pass-through for chat and messages with usage extracted from the stream — no buffering, no lost metrics.',
  },
  {
    icon: 'server',
    title: 'Self-hosted & light',
    description:
      'A single Go service you own: one container next to your stack. No SaaS middleman, no per-token markup.',
  },
  {
    icon: 'blocks',
    title: 'Any SDK works',
    description:
      'OpenAI and Anthropic client libraries, IDEs, and agent frameworks all connect by pointing at one base URL.',
  },
] as const
