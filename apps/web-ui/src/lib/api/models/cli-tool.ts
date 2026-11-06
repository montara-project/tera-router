/** GET /v1/cli-tools — one row per supported tool, found on the server host or not. */
export type CliToolStatus = {
  id: string
  installed: boolean
  /** binary or editor extension folder that was found */
  path: string
}

/** One config file a tool reads, with the gateway part of its content. */
export type CliToolFile = {
  /** absolute path on the server host */
  path: string
  /** path with the home folder shortened to ~ */
  display_path: string
  label: string
  /** the tool keeps other settings in this file; the content is merged in */
  partial: boolean
  content: string
}

export type CliToolEnvVar = { name: string; value: string; file: string }

/** GET /v1/cli-tools/:id — install status plus a config preview whose key is a
 * placeholder. */
export type CliToolDetail = CliToolStatus & {
  model_required: boolean
  files: CliToolFile[]
  env: CliToolEnvVar[]
}

/** POST /v1/cli-tools/:id/apply */
export type CliToolApplyResult = {
  /** absolute paths written on the server host */
  files: string[]
  key: { id: string; name: string }
}
