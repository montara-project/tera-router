/** GET /v1/cli-tools/claude-code — the Claude Code CLI on the server host
 * and what its settings file currently configures. */
export type ClaudeCodeStatus = {
  installed: boolean
  version: string
  binary_path: string
  /** absolute path of the settings file on the server host */
  config_path: string
  config_exists: boolean
  /** parse failure when the settings file exists but is not a JSON object */
  config_error: string
  base_url: string
  model: string
  /** API key whose plaintext is the configured ANTHROPIC_AUTH_TOKEN */
  current_key_id: string | null
}

/** GET /v1/cli-tools — one row per supported tool, found on the server host or not. */
export type CliToolStatus = {
  id: string
  installed: boolean
  /** binary or editor extension folder that was found */
  path: string
}
