export const dialects = [
  {
    name: 'OpenAI Chat Completions',
    endpoint: 'POST /v1/chat/completions',
    description:
      'The de-facto standard. Any OpenAI SDK, LangChain pipeline, Cursor config, or curl script works as-is — just swap the base URL.',
  },
  {
    name: 'Anthropic Messages',
    endpoint: 'POST /v1/messages',
    description:
      'Native Messages API including /v1/messages/count_tokens, so Claude Code and Anthropic SDKs connect without a shim.',
  },
  {
    name: 'OpenAI Responses',
    endpoint: 'POST /v1/responses',
    description:
      'The newer Responses API surface for agents and stateful workflows, routed to Responses-native providers like Codex.',
  },
] as const

// Mirrors apps/server/internal/catalog (Listed() plus the hidden Codex
// connect flow). Slugs drive the brand icon, same as the dashboard.
export type ProviderGroup = {
  label: string
  hint: string
  providers: { slug: string; name: string }[]
}

export const providerGroups: ProviderGroup[] = [
  {
    label: 'Chat & LLM',
    hint: 'Bring your own key — catalog presets ship the base URL and dialect.',
    providers: [
      { slug: 'openai', name: 'OpenAI' },
      { slug: 'anthropic', name: 'Anthropic' },
      { slug: 'gemini', name: 'Gemini' },
      { slug: 'openrouter', name: 'OpenRouter' },
      { slug: 'nvidia', name: 'NVIDIA NIM' },
      { slug: 'mistral', name: 'Mistral AI' },
      { slug: 'together', name: 'Together AI' },
      { slug: 'fireworks', name: 'Fireworks AI' },
      { slug: 'nebius', name: 'Nebius Token Factory' },
      { slug: 'groq', name: 'Groq' },
      { slug: 'cline', name: 'Cline' },
      { slug: 'cloudflare', name: 'Cloudflare AI' },
      { slug: 'muse', name: 'Meta Muse' },
    ],
  },
  {
    label: 'Subscription / OAuth',
    hint: 'Sign in with an existing ChatGPT subscription and route it over the Responses dialect.',
    providers: [{ slug: 'codex', name: 'OpenAI Codex' }],
  },
  {
    label: 'Search & embeddings',
    hint: 'Served on /v1/search, /v1/web/fetch, and /v1/embeddings behind the same gateway keys.',
    providers: [
      { slug: 'exa', name: 'Exa' },
      { slug: 'tavily', name: 'Tavily' },
      { slug: 'firecrawl', name: 'Firecrawl' },
      { slug: 'brave', name: 'Brave Search' },
      { slug: 'serper', name: 'Serper' },
      { slug: 'voyage-ai', name: 'Voyage AI' },
      { slug: 'jina-ai', name: 'Jina AI' },
    ],
  },
  {
    label: 'Voice',
    hint: 'Text-to-speech and transcription on /v1/audio/speech and /v1/audio/transcriptions.',
    providers: [
      { slug: 'elevenlabs', name: 'ElevenLabs' },
      { slug: 'deepgram', name: 'Deepgram' },
    ],
  },
  {
    label: 'Custom',
    hint: 'Any OpenAI- or Anthropic-compatible endpoint, with per-account base URLs.',
    providers: [
      { slug: 'custom-openai', name: 'OpenAI-compatible' },
      { slug: 'custom-anthropic', name: 'Anthropic-compatible' },
    ],
  },
]

export const steps = [
  {
    title: 'Connect providers',
    description:
      'Pick from the built-in catalog — API keys, OAuth sessions, or custom OpenAI- and Anthropic-compatible endpoints. Multiple accounts per provider, each with its own base URL and priority.',
    code: 'openai · anthropic · gemini · openrouter …',
  },
  {
    title: 'Route with fallback',
    description:
      'Every request enters one endpoint. The planner resolves accounts in priority order, cools down failures, and falls back across accounts and providers automatically.',
    code: 'glm-4.7 → kimi-k2 → claude-sonnet (fallback)',
  },
  {
    title: 'Observe everything',
    description:
      'Token usage is metered per request — including SSE streams — and lands in the admin dashboard: per key, per account, per model.',
    code: 'GET /admin/usage → per-key analytics',
  },
] as const
