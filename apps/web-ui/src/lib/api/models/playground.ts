/** One model the playground can address (gateway modelEntry). */
export type PlaygroundModel = {
  id: string
  /** provider slug for "provider/model" ids, otherwise "alias" or "chain" */
  owned_by: string
}
