/**
 * The coding tools the CLI tools pages cover, alphabetical. The config each
 * one gets comes from the server (GET /v1/cli-tools/:id), which also writes
 * it; this list only holds what the pages say about the tool. Logos live in
 * public/static/images/cli-tools/<id>.png.
 */
export type CliTool = {
  id: string
  name: string
  description: string
  /** Shell command that installs it; editor extensions have none. */
  install?: string
  /** First line of "Or set it up by hand": where the config goes. */
  manual: string
}

export const CLI_TOOLS: CliTool[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's CLI coding agent",
    install: 'npm install -g @anthropic-ai/claude-code',
    manual: 'Paste into ~/.claude/settings.json — Claude Code reads env vars from here.',
  },
  {
    id: 'cline-roo',
    name: 'Cline / Roo',
    description: 'VS Code AI coding assistant',
    manual:
      'Merge into ~/.cline/data/ JSON files — Cline stores API settings in globalState.json and secrets.json.',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI',
    install: 'npm install -g @openai/codex',
    manual:
      'Merge into ~/.codex/config.toml — the key lives in the provider block, so your Codex login in auth.json is left alone.',
  },
  {
    id: 'deepseek-tui',
    name: 'DeepSeek TUI',
    description: 'DeepSeek TUI',
    install: 'npm install -g deepseek-tui',
    manual: 'Write to ~/.deepseek/config.toml — DeepSeek TUI reads provider settings from TOML.',
  },
  {
    id: 'factory-droid',
    name: 'Factory Droid',
    description: 'Factory Droid CLI',
    install: 'curl -fsSL https://factory.ai/install.sh | sh',
    manual: 'Write to ~/.factory/settings.json — Droid loads custom models from this file.',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot (VS Code)',
    description: 'GitHub Copilot Chat',
    manual:
      "Write to VS Code's chatLanguageModels.json — Copilot Chat reads custom model providers from here. It is in ~/Library/Application Support/Code/User/ on macOS and ~/.config/Code/User/ on Linux.",
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    description: 'Hermes Agent CLI',
    install: 'npm install -g hermes-agent',
    manual:
      'Write config.yaml and .env to ~/.hermes/ — Hermes reads provider settings from YAML and env files.',
  },
  {
    id: 'jcode',
    name: 'jcode',
    description: 'jcode coding agent',
    install: 'npm install -g jcode',
    manual:
      'Write config.toml to ~/.jcode/ and the env file to ~/.config/jcode/ — jcode reads provider definitions from TOML.',
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    description: 'Kilo Code AI assistant',
    install: 'npm install -g @kilocode/cli',
    manual:
      'Write to ~/.local/share/kilo/auth.json — Kilo reads OpenAI-compatible provider config from here.',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'OpenClaw agent framework',
    install: 'npm install -g openclaw',
    manual:
      'Write to ~/.openclaw/openclaw.json — OpenClaw reads provider and model settings from here.',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode multi-model agent',
    install: 'npm install -g opencode-ai',
    manual:
      'Write to ~/.config/opencode/opencode.json — OpenCode loads custom providers from this file.',
  },
]
