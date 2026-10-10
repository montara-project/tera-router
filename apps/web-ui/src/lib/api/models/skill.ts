export type Skill = {
  id: string
  name: string
  description: string
  prompt: string
  /** when true the gateway appends the prompt to every request's system prompt */
  enabled: boolean
}
