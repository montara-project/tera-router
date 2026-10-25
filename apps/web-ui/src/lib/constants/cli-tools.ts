/**
 * Copy-paste setup for the coding tools Tera Router does not configure on the
 * host itself (Claude Code has its own apply flow). Every tool talks to the
 * gateway's OpenAI-compatible API at `${base}/v1`; the key and model stay
 * placeholders because keys are only revealed behind re-authentication.
 */

export const KEY_PLACEHOLDER = '<your-tera-router-key>'
export const MODEL_PLACEHOLDER = '<model-id>'

export type CliToolSnippet = {
  label: string
  /** Where the snippet goes, shown above it. */
  file?: string
  content: (base: string) => string
}

export type CliToolGuide = {
  steps: string[]
  snippets: CliToolSnippet[]
  /** Upstream docs for the config format. */
  docsUrl?: string
  /** True when the tool has no documented config we could verify. */
  generic?: boolean
}

const v1 = (base: string) => `${base.replace(/\/+$/, '')}/v1`

const envSnippet: CliToolSnippet = {
  label: 'Environment',
  file: 'shell profile',
  content: (base) =>
    `export OPENAI_BASE_URL="${v1(base)}"\nexport OPENAI_API_KEY="${KEY_PLACEHOLDER}"`,
}

/** VS Code extensions (Cline, Roo, Kilo Code) share the same settings form. */
const vscodeOpenAICompatible = (extension: string): CliToolGuide => ({
  steps: [
    `Open the ${extension} settings panel in VS Code.`,
    'Set API Provider to "OpenAI Compatible".',
    'Paste the Base URL and API Key below, then enter a Model ID routed by Tera Router.',
  ],
  snippets: [
    { label: 'Base URL', content: v1 },
    { label: 'API Key', content: () => KEY_PLACEHOLDER },
  ],
})

export const CLI_TOOL_GUIDES: Record<string, CliToolGuide> = {
  'codex-cli': {
    steps: [
      'Add the provider below to ~/.codex/config.toml.',
      'Export TERA_ROUTER_API_KEY with a Tera Router key, then run codex.',
    ],
    snippets: [
      {
        label: 'config.toml',
        file: '~/.codex/config.toml',
        content: (base) =>
          [
            `model = "${MODEL_PLACEHOLDER}"`,
            'model_provider = "tera-router"',
            '',
            '[model_providers.tera-router]',
            'name = "Tera Router"',
            `base_url = "${v1(base)}"`,
            'env_key = "TERA_ROUTER_API_KEY"',
            'wire_api = "responses"',
          ].join('\n'),
      },
      {
        label: 'Environment',
        file: 'shell profile',
        content: () => `export TERA_ROUTER_API_KEY="${KEY_PLACEHOLDER}"`,
      },
    ],
    docsUrl: 'https://github.com/openai/codex/blob/main/docs/config.md',
  },
  'cline-roo': vscodeOpenAICompatible('Cline / Roo Code'),
  'kilo-code': vscodeOpenAICompatible('Kilo Code'),
  'github-copilot': {
    steps: [
      'In VS Code, open Copilot Chat → model picker → Manage Models.',
      'Choose "OpenAI Compatible", paste the API key, and add a model with the entry below.',
    ],
    snippets: [
      { label: 'API Key', content: () => KEY_PLACEHOLDER },
      {
        label: 'Model entry',
        content: (base) =>
          JSON.stringify(
            {
              id: MODEL_PLACEHOLDER,
              name: 'Tera Router',
              url: v1(base),
              toolCalling: true,
              vision: false,
              maxInputTokens: 128000,
              maxOutputTokens: 16000,
            },
            null,
            2
          ),
      },
    ],
    docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/language-models',
  },
  'factory-droid': {
    steps: ['Add the model below to ~/.factory/settings.json, then pick it with /model in droid.'],
    snippets: [
      {
        label: 'settings.json',
        file: '~/.factory/settings.json',
        content: (base) =>
          JSON.stringify(
            {
              customModels: [
                {
                  model: MODEL_PLACEHOLDER,
                  displayName: 'Tera Router',
                  baseUrl: v1(base),
                  apiKey: KEY_PLACEHOLDER,
                  provider: 'generic-chat-completion-api',
                  maxOutputTokens: 16384,
                },
              ],
            },
            null,
            2
          ),
      },
    ],
    docsUrl: 'https://docs.factory.ai/cli/byok/overview',
  },
  openclaw: {
    steps: ['Merge the provider below into your OpenClaw config (openclaw.json).'],
    snippets: [
      {
        label: 'openclaw.json',
        file: '~/.openclaw/openclaw.json',
        content: (base) =>
          JSON.stringify(
            {
              agents: { defaults: { model: { primary: `tera-router/${MODEL_PLACEHOLDER}` } } },
              models: {
                mode: 'merge',
                providers: {
                  'tera-router': {
                    baseUrl: v1(base),
                    apiKey: KEY_PLACEHOLDER,
                    api: 'openai-completions',
                    models: [{ id: MODEL_PLACEHOLDER, name: 'Tera Router' }],
                  },
                },
              },
            },
            null,
            2
          ),
      },
    ],
  },
  opencode: {
    steps: ['Add the provider below to opencode.json, then select tera-router in /models.'],
    snippets: [
      {
        label: 'opencode.json',
        file: '~/.config/opencode/opencode.json',
        content: (base) =>
          JSON.stringify(
            {
              $schema: 'https://opencode.ai/config.json',
              provider: {
                'tera-router': {
                  npm: '@ai-sdk/openai-compatible',
                  name: 'Tera Router',
                  options: { baseURL: v1(base), apiKey: KEY_PLACEHOLDER },
                  models: { [MODEL_PLACEHOLDER]: { name: 'Tera Router' } },
                },
              },
            },
            null,
            2
          ),
      },
    ],
    docsUrl: 'https://opencode.ai/docs/providers',
  },
  'hermes-agent': {
    steps: ['Set the model block below in ~/.hermes/config.yaml.'],
    snippets: [
      {
        label: 'config.yaml',
        file: '~/.hermes/config.yaml',
        content: (base) =>
          [
            'model:',
            `  default: ${MODEL_PLACEHOLDER}`,
            '  provider: custom',
            `  base_url: ${v1(base)}`,
            `  api_key: ${KEY_PLACEHOLDER}`,
          ].join('\n'),
      },
    ],
  },
  'deepseek-tui': {
    steps: [
      'Point the tool at an OpenAI-compatible endpoint using its custom provider or base URL option.',
      'Most OpenAI-compatible clients also read the variables below.',
    ],
    snippets: [envSnippet],
    generic: true,
  },
  jcode: {
    steps: [
      'Point the tool at an OpenAI-compatible endpoint using its custom provider or base URL option.',
      'Most OpenAI-compatible clients also read the variables below.',
    ],
    snippets: [envSnippet],
    generic: true,
  },
}
