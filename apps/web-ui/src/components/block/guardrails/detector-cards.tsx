import {
  IconAlertTriangle,
  IconChevronRight,
  IconFingerprint,
  IconMessageExclamation,
  IconScale,
  IconTag,
  type TablerIcon,
} from '@tabler/icons-react'
import { useState } from 'react'

import type { GuardrailsPolicyConfig as PolicyConfig } from '@/lib/api/models/guardrails'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export const PII_ENTITIES = [
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
  'CREDIT_CARD',
  'IBAN_CODE',
  'IP_ADDRESS',
  'URL',
  'ID_NIK',
  'ID_NPWP',
  'ID_PASSPORT',
  'PERSON',
]

export const TOXICITY_CATEGORIES = ['profanity', 'hate speech', 'harassment', 'violence', 'sexual']

export const BIAS_CATEGORIES = ['political', 'gender', 'ethnic', 'religious']

export const MASKING_STRATEGIES = [
  { value: 'redact', label: 'Redact — replace with <PII>' },
  { value: 'mask', label: 'Mask — asterisks' },
  { value: 'hash', label: 'Hash — irreversible' },
]

export const DETECTION_ENGINES = [
  { value: 'native', label: 'Native (Go, default) — Indonesian + Presidio-compatible' },
  { value: 'presidio', label: 'Presidio sidecar — full entity catalog' },
]

export const SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export const MATCH_ACTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'redact', label: 'Redact' },
  { value: 'warn', label: 'Warn' },
  { value: 'log', label: 'Log only' },
]

export const TOPIC_MODES = [
  { value: 'block', label: 'Block list (deny these)' },
  { value: 'allow', label: 'Allow list (allow only these)' },
]

export const MATCHING_ENGINES = [
  { value: 'keyword', label: 'Keyword (default) — substring + token match' },
  { value: 'embedding', label: 'Embeddings — semantic similarity' },
]

export const SCORING_ENGINES = [
  { value: 'native', label: 'Native (Go, default) — keyword catalog (id + en)' },
  { value: 'openai', label: '[OI] moderation — server API key' },
]

type Section = keyof PolicyConfig

interface DetectorCardsProps {
  config: PolicyConfig
  onPatch: (section: Section, patch: Partial<PolicyConfig[Section]>) => void
}

interface DetectorMeta {
  key: Section
  label: string
  /** Muted line shown while the detector is off: what it looks for. */
  hint: string
  icon: TablerIcon
  experimental?: boolean
  /** Muted line shown while it is on: the settings in force. */
  summary: (config: PolicyConfig) => string
}

// Design order, matching the canvas frame: PII, injection, topics, toxicity,
// bias.
const DETECTORS: DetectorMeta[] = [
  {
    key: 'pii',
    label: 'PII',
    hint: 'Emails, phone numbers, NIK, NPWP, API keys…',
    icon: IconFingerprint,
    summary: (config) =>
      `${config.pii.entities.length || 'All'} entities · ${config.pii.masking_strategy}`,
  },
  {
    key: 'injection',
    label: 'Prompt injection',
    hint: 'Jailbreaks, role overrides, prompt leaks',
    icon: IconAlertTriangle,
    summary: (config) => `${config.injection.severity} · ${config.injection.action}`,
  },
  {
    key: 'topics',
    label: 'Topics',
    hint: 'Keep chats on or off listed topics',
    icon: IconTag,
    summary: (config) => `${config.topics.mode} list · ${config.topics.action}`,
  },
  {
    key: 'toxicity',
    label: 'Toxicity',
    hint: 'Profanity, hate, harassment, violence, sexual',
    icon: IconMessageExclamation,
    summary: (config) => `threshold ${config.toxicity.threshold} · ${config.toxicity.action}`,
  },
  {
    key: 'bias',
    label: 'Bias',
    hint: 'Political, gender, ethnic, religious',
    icon: IconScale,
    experimental: true,
    summary: (config) => `threshold ${config.bias.threshold} · ${config.bias.action}`,
  },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] font-medium text-foreground">{children}</p>
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs leading-relaxed">{children}</p>
}

function SelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onValueChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Toggle that shares a row with a label but no description. */
function InlineToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <FieldLabel>{label}</FieldLabel>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option)

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option)}
            className={cn(
              'h-7 cursor-pointer rounded-md border px-2 font-mono text-[11.5px] transition-colors',
              active
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function ThresholdField({
  label,
  ariaLabel,
  value,
  max,
  step,
  onCommit,
}: {
  label: string
  ariaLabel: string
  value: number
  max: number
  step?: number
  onCommit: (value: number) => void
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onCommit(Number(event.target.value))}
      />
    </div>
  )
}

function PiiFields({ config, onPatch }: DetectorCardsProps) {
  const toggleEntity = (entity: string) =>
    onPatch('pii', {
      entities: config.pii.entities.includes(entity)
        ? config.pii.entities.filter((item) => item !== entity)
        : [...config.pii.entities, entity],
    })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <FieldLabel>Entities</FieldLabel>
          <FieldHint>None selected detects every entity</FieldHint>
        </div>
        <ChipGroup options={PII_ENTITIES} selected={config.pii.entities} onToggle={toggleEntity} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Masking strategy"
          value={config.pii.masking_strategy}
          options={MASKING_STRATEGIES}
          onValueChange={(masking_strategy) => onPatch('pii', { masking_strategy })}
        />
        <ThresholdField
          label="Minimum confidence (0–1)"
          ariaLabel="Minimum confidence"
          value={config.pii.min_confidence}
          max={1}
          step={0.05}
          onCommit={(min_confidence) => onPatch('pii', { min_confidence })}
        />
      </div>

      <SelectField
        label="Engine"
        value={config.pii.engine}
        options={DETECTION_ENGINES}
        onValueChange={(engine) => onPatch('pii', { engine })}
      />
      <FieldHint>
        Presidio needs the analyzer sidecar (compose.presidio.yaml); the gateway falls back to the
        native detector when it is unreachable.
      </FieldHint>

      <InlineToggle
        label="Also scan model output"
        checked={config.pii.scan_output}
        onCheckedChange={(scan_output) => onPatch('pii', { scan_output })}
      />
    </div>
  )
}

function InjectionFields({ config, onPatch }: DetectorCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Severity threshold"
        value={config.injection.severity}
        options={SEVERITIES}
        onValueChange={(severity) => onPatch('injection', { severity })}
      />
      <SelectField
        label="Action on match"
        value={config.injection.action}
        options={MATCH_ACTIONS}
        onValueChange={(action) => onPatch('injection', { action })}
      />
    </div>
  )
}

function TopicsFields({ config, onPatch }: DetectorCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Mode"
          value={config.topics.mode}
          options={TOPIC_MODES}
          onValueChange={(mode) => onPatch('topics', { mode })}
        />
        <SelectField
          label="Action"
          value={config.topics.action}
          options={MATCH_ACTIONS}
          onValueChange={(action) => onPatch('topics', { action })}
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Topics (comma separated)</FieldLabel>
        <Input
          value={config.topics.topics.join(', ')}
          placeholder="programming, devops, cyber security"
          aria-label="Topics, comma separated"
          onChange={(event) =>
            onPatch('topics', {
              topics: event.target.value.split(',').map((topic) => topic.trimStart()),
            })
          }
        />
      </div>

      <SelectField
        label="Matching engine"
        value={config.topics.engine}
        options={MATCHING_ENGINES}
        onValueChange={(engine) => onPatch('topics', { engine })}
      />
      <FieldHint>
        Embeddings catch paraphrases the keyword path misses and need an embeddings provider
        configured in <code className="font-mono">cache.embedding_provider=api</code>.
      </FieldHint>
    </div>
  )
}

function ToxicityFields({ config, onPatch }: DetectorCardsProps) {
  const toggleCategory = (category: string) =>
    onPatch('toxicity', {
      categories: config.toxicity.categories.includes(category)
        ? config.toxicity.categories.filter((item) => item !== category)
        : [...config.toxicity.categories, category],
    })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <FieldLabel>Categories</FieldLabel>
          <FieldHint>None selected scores every category</FieldHint>
        </div>
        <ChipGroup
          options={TOXICITY_CATEGORIES}
          selected={config.toxicity.categories}
          onToggle={toggleCategory}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ThresholdField
          label="Threshold (0–100)"
          ariaLabel="Toxicity threshold"
          value={config.toxicity.threshold}
          max={100}
          onCommit={(threshold) => onPatch('toxicity', { threshold })}
        />
        <SelectField
          label="Action"
          value={config.toxicity.action}
          options={MATCH_ACTIONS}
          onValueChange={(action) => onPatch('toxicity', { action })}
        />
      </div>

      <SelectField
        label="Scoring engine"
        value={config.toxicity.engine}
        options={SCORING_ENGINES}
        onValueChange={(engine) => onPatch('toxicity', { engine })}
      />
      <FieldHint>
        [OI] scoring needs{' '}
        <code className="font-mono">TERAROUTER_GUARDRAILS_TOXICITY__OPENAI_API_KEY</code> on the
        server and falls back to native without it.
      </FieldHint>
    </div>
  )
}

function BiasFields({ config, onPatch }: DetectorCardsProps) {
  const toggleCategory = (category: string) =>
    onPatch('bias', {
      categories: config.bias.categories.includes(category)
        ? config.bias.categories.filter((item) => item !== category)
        : [...config.bias.categories, category],
    })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <FieldLabel>Categories</FieldLabel>
          <FieldHint>None selected scores every category</FieldHint>
        </div>
        <ChipGroup
          options={BIAS_CATEGORIES}
          selected={config.bias.categories}
          onToggle={toggleCategory}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ThresholdField
          label="Threshold (0–100)"
          ariaLabel="Bias threshold"
          value={config.bias.threshold}
          max={100}
          onCommit={(threshold) => onPatch('bias', { threshold })}
        />
        <SelectField
          label="Action"
          value={config.bias.action}
          options={MATCH_ACTIONS}
          onValueChange={(action) => onPatch('bias', { action })}
        />
      </div>
    </div>
  )
}

const FIELDS: Record<Section, (props: DetectorCardsProps) => React.ReactNode> = {
  pii: (props) => <PiiFields {...props} />,
  injection: (props) => <InjectionFields {...props} />,
  topics: (props) => <TopicsFields {...props} />,
  toxicity: (props) => <ToxicityFields {...props} />,
  bias: (props) => <BiasFields {...props} />,
}

/**
 * The detector list: one collapsible row per detector with its switch on the
 * right, and the settings of that detector inline when the row is open. A row
 * starts open when its detector is already on.
 */
export function DetectorCards({ config, onPatch }: DetectorCardsProps) {
  const [open, setOpen] = useState<Section[]>(() =>
    DETECTORS.filter((detector) => config[detector.key].enabled).map((detector) => detector.key)
  )

  const toggleRow = (key: Section) =>
    setOpen((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )

  return (
    <ul className="overflow-hidden rounded-lg border border-border bg-card">
      {DETECTORS.map((detector) => {
        const enabled = config[detector.key].enabled
        const expanded = open.includes(detector.key)
        const panelId = `guardrail-detector-${detector.key}`

        return (
          <li key={detector.key} className="border-b border-border last:border-0">
            <div className="flex items-center gap-2 pr-3">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleRow(detector.key)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2.5 pl-3 text-left"
              >
                <IconChevronRight
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
                    expanded && 'rotate-90'
                  )}
                  stroke={1.75}
                  aria-hidden
                />
                <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                  <detector.icon className="size-4" stroke={1.75} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-medium text-foreground">{detector.label}</span>
                  {detector.experimental ? (
                    <Badge variant="secondary" size="sm">
                      Experimental
                    </Badge>
                  ) : null}
                  <span
                    className="text-muted-foreground min-w-0 truncate text-xs"
                    title={enabled ? detector.summary(config) : detector.hint}
                  >
                    {enabled ? detector.summary(config) : detector.hint}
                  </span>
                </span>
              </button>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => onPatch(detector.key, { enabled: checked })}
                aria-label={`Enable ${detector.label} detection`}
              />
            </div>

            {expanded ? (
              <div id={panelId} className="bg-muted/30 border-t border-border px-4 py-4 sm:pl-14">
                {FIELDS[detector.key]({ config, onPatch })}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
