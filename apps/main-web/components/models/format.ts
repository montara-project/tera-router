// Formatting and filtering for the public model page, ported from the
// tera-router-provider portal catalog (apps/web-ui catalog-format.ts). Prices
// are USD only here: visitors have no wallet, so no IDR display currency.

/** OpenRouter's pricing block: each rate is USD per token as a string. */
export type ModelPricing = {
  prompt: string
  completion: string
  input_cache_read?: string
  input_cache_write?: string
  internal_reasoning?: string
}

/** One row of GET /v1/public/models (the same shape as /v1/models). */
export type PublicModel = {
  id: string
  name: string
  context_length: number | null
  max_output_tokens: number | null
  thinking: boolean
  tool_call: boolean
  reasoning_level: string
  pricing: ModelPricing
  /** What the first target costs upstream, for the vs-listed comparison. */
  base_price?: ModelPricing
  /** The operator's group label, shown as the model's provider; empty is ungrouped. */
  group?: string
}

export const ALL_CATEGORY = 'all'
const UNGROUPED_CATEGORY = ''

export type SortKey = 'name' | 'input' | 'output' | 'context' | 'discount'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }
export type SortValue = `${SortKey}-${'asc' | 'desc'}`

/** Biggest saving against the listed price first, as in the portal. */
export const DEFAULT_SORT: Sort = { key: 'discount', dir: 'desc' }

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'discount-desc', label: 'Biggest discount' },
  { value: 'discount-asc', label: 'Smallest discount' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'input-asc', label: 'Input price: low to high' },
  { value: 'input-desc', label: 'Input price: high to low' },
  { value: 'output-asc', label: 'Output price: low to high' },
  { value: 'output-desc', label: 'Output price: high to low' },
  { value: 'context-desc', label: 'Context: largest first' },
  { value: 'context-asc', label: 'Context: smallest first' },
]

export const sortValueOf = (sort: Sort): SortValue => `${sort.key}-${sort.dir}`

export const sortOfValue = (value: SortValue): Sort => {
  const [key, dir] = value.split('-') as [SortKey, 'asc' | 'desc']
  return { key, dir }
}

/** All, one chip per provider group, then Other for ungrouped models. */
export function groupChips(models: PublicModel[]): { value: string; label: string }[] {
  const groups = new Set<string>()
  let ungrouped = false
  for (const model of models) {
    if (model.group) groups.add(model.group)
    else ungrouped = true
  }
  const chips = [...groups].sort().map((g) => ({ value: g, label: g }))
  if (ungrouped) chips.push({ value: UNGROUPED_CATEGORY, label: 'Other' })
  return [{ value: ALL_CATEGORY, label: 'All' }, ...chips]
}

/** Rows in the chosen group whose id contains the search text. */
export function filterModels(models: PublicModel[], search: string, category: string) {
  const needle = search.trim().toLowerCase()
  return models.filter(
    (m) =>
      (category === ALL_CATEGORY || (m.group ?? '') === category) &&
      (!needle || m.id.toLowerCase().includes(needle))
  )
}

/** Per-token string (USD per token) → USD per 1M tokens. */
export function perMillion(perToken: string | undefined): number | null {
  if (perToken === undefined || perToken === '') return null
  const value = Number(perToken)
  return Number.isFinite(value) ? value * 1_000_000 : null
}

/** USD per 1M tokens, or an em dash when the rate is unset: $0, $0.075, $1.25. */
export function priceCell(perToken: string | undefined): string {
  const value = perMillion(perToken)
  if (value === null) return '—'
  if (value === 0) return '$0'
  return `$${value.toFixed(4).replace(/\.?0+$/, '')}`
}

/** A "sample request": a small chat call's worth of tokens, for estimates and the discount. */
const SAMPLE_INPUT_TOKENS = 2048
const SAMPLE_OUTPUT_TOKENS = 512
export const SAMPLE_LABEL = '2K input + 512 output tokens'

/** USD cost of one sample request at these rates; null when either rate is missing. */
export function sampleCost(pricing: ModelPricing | undefined): number | null {
  const input = perMillion(pricing?.prompt)
  const output = perMillion(pricing?.completion)
  if (input === null || output === null) return null
  return (input * SAMPLE_INPUT_TOKENS + output * SAMPLE_OUTPUT_TOKENS) / 1_000_000
}

/** "$0.0012", or "< $0.0001" for tiny non-zero amounts. */
export function formatSample(dollars: number): string {
  if (dollars === 0) return '$0'
  if (dollars < 0.0001) return '< $0.0001'
  return `$${dollars.toFixed(dollars >= 1 ? 2 : 4)}`
}

/** Free means both the input and the output rate are exactly zero. */
export function isFree(model: PublicModel): boolean {
  return perMillion(model.pricing.prompt) === 0 && perMillion(model.pricing.completion) === 0
}

/** Saving against the listed upstream price on a sample request, in percent (negative is
 * dearer); null when there is no listed price to compare with. */
export function listedDelta(model: PublicModel): number | null {
  const listed = sampleCost(model.base_price)
  const ours = sampleCost(model.pricing)
  if (listed === null || ours === null || listed <= 0) return null
  return Math.round(((listed - ours) / listed) * 100)
}

/** Capability labels shared by the card and table views. */
export function capabilities(model: PublicModel): string[] {
  const out: string[] = []
  if (model.thinking || (model.reasoning_level && model.reasoning_level !== 'none')) {
    out.push('Reasoning')
  }
  if (priceCell(model.pricing.input_cache_read) !== '—') out.push('Cache')
  if (model.tool_call) out.push('Tool calls')
  return out
}

/** Context window shortened: 8K, 128K, 1.05M; an em dash when unset. */
export function contextLabel(value: number | null): string {
  if (!value) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  return `${Math.round(value / 1000)}K`
}

function sortNumber(model: PublicModel, key: SortKey): number | null {
  switch (key) {
    case 'input':
      return perMillion(model.pricing.prompt)
    case 'output':
      return perMillion(model.pricing.completion)
    case 'context':
      return model.context_length || null
    case 'discount':
      return listedDelta(model)
    default:
      return null
  }
}

/** A sorted copy. Models without a value for the key go last either way; ties fall back to the id. */
export function sortModels(models: PublicModel[], sort: Sort): PublicModel[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...models].sort((a, b) => {
    if (sort.key === 'name') return a.id.localeCompare(b.id) * sign
    const left = sortNumber(a, sort.key)
    const right = sortNumber(b, sort.key)
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1
    } else if (left !== right) {
      return (left - right) * sign
    }
    return a.id.localeCompare(b.id)
  })
}

export const PAGE_SIZE = 48
