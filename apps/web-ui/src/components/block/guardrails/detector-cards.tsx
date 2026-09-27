import {
  IconAlertTriangle,
  IconScale,
  IconShieldCheck,
  IconSlash,
  IconTag,
} from '@tabler/icons-react'

import type { GuardrailsPolicyConfig as PolicyConfig } from '@/lib/api/models/guardrails'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  { value: 'redact', label: 'Redact — Replace with <PII>' },
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
  { value: 'openai', label: 'OpenAI moderation — server API key' },
]

type Section = keyof PolicyConfig

interface DetectorCardsProps {
  config: PolicyConfig
  onPatch: (section: Section, patch: Partial<PolicyConfig[Section]>) => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs font-medium">{children}</p>
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

function ToggleRow({
  label,
  sub,
  checked,
  onCheckedChange,
}: {
  label: string
  sub?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="data-[state=checked]:bg-amber-600"
      />
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
              'cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-colors',
              active
                ? 'border-border bg-accent text-foreground'
                : 'text-muted-foreground border-border/60 bg-transparent hover:bg-accent/50'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function DetectorSection({
  icon: Icon,
  tileClass,
  title,
  description,
  experimental,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  tileClass: string
  title: string
  description: string
  experimental?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="bg-card">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              tileClass
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          </div>
          {experimental ? (
            <Badge variant="secondary" size="sm">
              Experimental
            </Badge>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function DetectorCards({ config, onPatch }: DetectorCardsProps) {
  return (
    <>
      <DetectorSection
        icon={IconShieldCheck}
        tileClass="bg-emerald-950 text-emerald-400"
        title="PII Detection"
        description="Block, mask, or anonymize personal data. Presidio-compatible entity catalog plus Indonesian recognizers (NIK, NPWP, Indonesian passport, +62 phone)."
      >
        <ToggleRow
          label="Enable PII Detection"
          checked={config.pii.enabled}
          onCheckedChange={(enabled) => onPatch('pii', { enabled })}
        />
        {config.pii.enabled ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Entities to detect</FieldLabel>
              <ChipGroup
                options={PII_ENTITIES}
                selected={config.pii.entities}
                onToggle={(entity) =>
                  onPatch('pii', {
                    entities: config.pii.entities.includes(entity)
                      ? config.pii.entities.filter((item) => item !== entity)
                      : [...config.pii.entities, entity],
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Empty = all entities. Pick specific types to constrain detection.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField
                label="Masking Strategy"
                value={config.pii.maskingStrategy}
                options={MASKING_STRATEGIES}
                onValueChange={(maskingStrategy) => onPatch('pii', { maskingStrategy })}
              />
              <div className="min-w-0 space-y-1.5">
                <FieldLabel>Minimum confidence (0.0–1.0)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.pii.minConfidence}
                  aria-label="Minimum confidence"
                  onChange={(event) =>
                    onPatch('pii', { minConfidence: Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <SelectField
              label="Detection engine"
              value={config.pii.engine}
              options={DETECTION_ENGINES}
              onValueChange={(engine) => onPatch('pii', { engine })}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Presidio requires the analyzer sidecar (compose.presidio.yaml). Falls back to native
              if the sidecar is unreachable.
            </p>

            <ToggleRow
              label="Scan output (LLM response)"
              sub="Also redact PII the model may leak in its reply"
              checked={config.pii.scanOutput}
              onCheckedChange={(scanOutput) => onPatch('pii', { scanOutput })}
            />
          </>
        ) : null}
      </DetectorSection>

      <DetectorSection
        icon={IconAlertTriangle}
        tileClass="bg-red-950 text-red-400"
        title="Prompt Injection Detection"
        description="Block jailbreak attempts (DAN, ignore–previous, role overrides, prompt-leak attempts)."
      >
        <ToggleRow
          label="Enable Injection Detection"
          checked={config.injection.enabled}
          onCheckedChange={(enabled) => onPatch('injection', { enabled })}
        />
        {config.injection.enabled ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        ) : null}
      </DetectorSection>

      <DetectorSection
        icon={IconTag}
        tileClass="bg-amber-950 text-amber-400"
        title="Topic Boundaries"
        description="Restrict allowed conversation topics."
      >
        <ToggleRow
          label="Enable Topic Boundaries"
          checked={config.topics.enabled}
          onCheckedChange={(enabled) => onPatch('topics', { enabled })}
        />
        {config.topics.enabled ? (
          <>
            <SelectField
              label="Mode"
              value={config.topics.mode}
              options={TOPIC_MODES}
              onValueChange={(mode) => onPatch('topics', { mode })}
            />
            <div className="min-w-0 space-y-1.5">
              <FieldLabel>Topics (comma separated)</FieldLabel>
              <Input
                value={config.topics.topics.join(', ')}
                placeholder="programming, devops, cyber security"
                onChange={(event) =>
                  onPatch('topics', {
                    topics: event.target.value.split(',').map((topic) => topic.trimStart()),
                  })
                }
              />
            </div>
            <SelectField
              label="Action"
              value={config.topics.action}
              options={MATCH_ACTIONS}
              onValueChange={(action) => onPatch('topics', { action })}
            />
            <SelectField
              label="Matching engine"
              value={config.topics.engine}
              options={MATCHING_ENGINES}
              onValueChange={(engine) => onPatch('topics', { engine })}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Embedding catches paraphrases the keyword path misses. Requires an embeddings provider
              configured in cache.embedding_provider=api.
            </p>
          </>
        ) : null}
      </DetectorSection>

      <DetectorSection
        icon={IconSlash}
        tileClass="bg-red-950 text-red-400"
        title="Toxicity Detection"
        description="Classify and filter profanity, hate speech, harassment, violence, and sexual content."
      >
        <ToggleRow
          label="Enable Toxicity Detection"
          checked={config.toxicity.enabled}
          onCheckedChange={(enabled) => onPatch('toxicity', { enabled })}
        />
        {config.toxicity.enabled ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Categories</FieldLabel>
              <ChipGroup
                options={TOXICITY_CATEGORIES}
                selected={config.toxicity.categories}
                onToggle={(category) =>
                  onPatch('toxicity', {
                    categories: config.toxicity.categories.includes(category)
                      ? config.toxicity.categories.filter((item) => item !== category)
                      : [...config.toxicity.categories, category],
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <FieldLabel>Threshold (0–100)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.toxicity.threshold}
                  aria-label="Toxicity threshold"
                  onChange={(event) =>
                    onPatch('toxicity', { threshold: Number(event.target.value) })
                  }
                />
              </div>
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
            <p className="text-muted-foreground text-xs leading-relaxed">
              OpenAI engine needs{' '}
              <code className="font-mono">TERAROUTER_GUARDRAILS_TOXICITY__OPENAI_API_KEY</code> set
              on the server. Falls back to native if the key is missing.
            </p>
          </>
        ) : null}
      </DetectorSection>

      <DetectorSection
        icon={IconScale}
        tileClass="bg-amber-950 text-amber-400"
        title="Bias Detection"
        description="Scan output for political, gender, ethnic, or religious bias."
        experimental
      >
        <ToggleRow
          label="Enable Bias Detection"
          checked={config.bias.enabled}
          onCheckedChange={(enabled) => onPatch('bias', { enabled })}
        />
        {config.bias.enabled ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Categories</FieldLabel>
              <ChipGroup
                options={BIAS_CATEGORIES}
                selected={config.bias.categories}
                onToggle={(category) =>
                  onPatch('bias', {
                    categories: config.bias.categories.includes(category)
                      ? config.bias.categories.filter((item) => item !== category)
                      : [...config.bias.categories, category],
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <FieldLabel>Threshold (0–100)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.bias.threshold}
                  aria-label="Bias threshold"
                  onChange={(event) => onPatch('bias', { threshold: Number(event.target.value) })}
                />
              </div>
              <SelectField
                label="Action"
                value={config.bias.action}
                options={MATCH_ACTIONS}
                onValueChange={(action) => onPatch('bias', { action })}
              />
            </div>
          </>
        ) : null}
      </DetectorSection>
    </>
  )
}
