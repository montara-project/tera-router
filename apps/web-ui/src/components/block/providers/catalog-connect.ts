/** Catalog cards whose Connect opens the custom-provider form pre-prefilled. */
export const CUSTOM_CONNECT_PRESETS: Record<string, { slug: string; api_kind: string }> = {
  'custom-openai': { slug: 'custom-openai', api_kind: 'openai' },
  'custom-anthropic': { slug: 'custom-anthropic', api_kind: 'anthropic' },
}

/** Catalog tiles that support BOTH API-key and official-website sign-in:
 * Connect offers a choice between the key form and the OAuth popup flow.
 * Values are the OAuth flow slugs the server accepts. */
export const OAUTH_FLOW_FOR: Record<string, string> = {
  openai: 'codex',
  anthropic: 'anthropic',
}

/** API-key providers wired end-to-end: Connect opens the key form, and the
 * stored model catalog can be re-synced from the connected card. Connecting
 * one of these also persists the provider's custom_providers row server-side,
 * so the connected card links to the DB-backed detail page instead of the
 * prov-<slug> catalog view. */
export const API_KEY_PROVIDERS: Record<string, { name: string }> = {
  openai: { name: 'OpenAI' },
  anthropic: { name: 'Anthropic' },
  openrouter: { name: 'OpenRouter' },
  nvidia: { name: 'NVIDIA NIM' },
  cline: { name: 'Cline' },
  cloudflare: { name: 'Cloudflare AI' },
}
