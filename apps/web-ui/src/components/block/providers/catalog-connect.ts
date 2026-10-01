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

/** API-key providers wired end-to-end: Connect opens the key form, and the
 * stored model catalog can be re-synced from the connected card. ollama-local
 * needs no credential at all. */
export const API_KEY_PROVIDERS: Record<string, { name: string; authKind?: 'none' }> = {
  openrouter: { name: 'OpenRouter' },
  ollama: { name: 'Ollama Cloud' },
  'ollama-local': { name: 'Ollama Local', authKind: 'none' },
  cline: { name: 'Cline' },
  cloudflare: { name: 'Cloudflare AI' },
}

export const SYNCABLE_PROVIDERS = new Set(Object.keys(API_KEY_PROVIDERS))
