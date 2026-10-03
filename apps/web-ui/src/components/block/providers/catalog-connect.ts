/** Catalog cards whose Connect opens the custom-provider form pre-prefilled. */
export const CUSTOM_CONNECT_PRESETS: Record<string, { slug: string; api_kind: string }> = {
  'custom-openai': { slug: 'custom-openai', api_kind: 'openai' },
  'custom-anthropic': { slug: 'custom-anthropic', api_kind: 'anthropic' },
}

/** OAuth providers: Connect opens the provider's official web in a popup. */
export const OAUTH_PROVIDERS: Record<string, string> = {
  claude: 'Anthropic (Claude Code)',
  codex: 'OpenAI (Codex)',
}

/** Catalog tiles that support BOTH API-key and official-website sign-in:
 * Connect offers a choice between the key form and the OAuth popup flow. */
export const DUAL_AUTH_PROVIDERS: Record<string, { name: string }> = {
  openai: { name: 'OpenAI' },
  anthropic: { name: 'Anthropic' },
}

/** API-key providers wired end-to-end: Connect opens the key form, and the
 * stored model catalog can be re-synced from the connected card. ollama-local
 * needs no credential at all. Connecting one of these also persists the
 * provider's custom_providers row server-side, so the connected card links to
 * the DB-backed detail page instead of the prov-<slug> catalog view. */
export const API_KEY_PROVIDERS: Record<string, { name: string; authKind?: 'none' }> = {
  openai: { name: 'OpenAI' },
  anthropic: { name: 'Anthropic' },
  openrouter: { name: 'OpenRouter' },
  nvidia: { name: 'NVIDIA NIM' },
  ollama: { name: 'Ollama Cloud' },
  'ollama-local': { name: 'Ollama Local', authKind: 'none' },
  cline: { name: 'Cline' },
  cloudflare: { name: 'Cloudflare AI' },
}

export const SYNCABLE_PROVIDERS = new Set(Object.keys(API_KEY_PROVIDERS))
