import {
  IconAlertTriangle,
  IconBan,
  IconChartBar,
  IconChevronDown,
  IconEyeOff,
  IconShield,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { GuardrailPolicy, GuardrailsScope } from '@/lib/api/models/guardrails'
import type { ApiKeyDetail } from '@/lib/api/models/key'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import EditPolicyDialog from '@/components/block/guardrails/edit-policy-dialog'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const UPSTREAM_SCOPES: GuardrailsScope[] = ['global', 'provider', 'model', 'chain']

const DETECTORS = [
  { key: 'pii', label: 'PII', aliases: ['pii'] },
  { key: 'injection', label: 'Prompt injection', aliases: ['injection', 'prompt injection'] },
  { key: 'topics', label: 'Topics', aliases: ['topics'] },
  { key: 'toxicity', label: 'Toxicity', aliases: ['toxicity'] },
  { key: 'bias', label: 'Bias', aliases: ['bias'] },
] as const

type DetectorKey = (typeof DETECTORS)[number]['key']

/** Most specific first, matching the server's ListEnabled ordering. */
const SPECIFICITY_ORDER: GuardrailsScope[] = ['key', 'chain', 'model', 'provider', 'global']

type EffectiveDetector = {
  key: DetectorKey
  label: string
  enabled: boolean
  source: 'key' | 'inherited' | 'off'
  config?: Record<string, unknown>
}

export default function KeyGuardrailsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const [dialog, setDialog] = useState<{ policy: GuardrailPolicy; mode: 'create' | 'edit' } | null>(
    null
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mergedOpen, setMergedOpen] = useState(false)

  const overviewQuery = useQuery(queries.guardrails.overview())
  const statsQuery = useQuery(queries.keys.guardrailStats(apiKey.id))
  const policies = useMemo(() => overviewQuery.data?.data.policies ?? [], [overviewQuery.data])

  // Key-scoped policies target the key id, which is unambiguous; a name could
  // collide with another key.
  const keyPolicies = useMemo(
    () => policies.filter((policy) => policy.scope === 'key' && policy.target === apiKey.id),
    [policies, apiKey.id]
  )
  const upstreamPolicies = useMemo(
    () => policies.filter((policy) => UPSTREAM_SCOPES.includes(policy.scope) && policy.enabled),
    [policies]
  )

  const effective = useMemo(
    () => mergeDetectors(keyPolicies, upstreamPolicies),
    [keyPolicies, upstreamPolicies]
  )
  const activeDetectors = effective.filter((detector) => detector.enabled)

  const draftPolicy = useMemo<GuardrailPolicy>(
    () => ({
      id: 'draft',
      name: `${apiKey.name} policy`,
      enabled: true,
      scope: 'key',
      target: apiKey.id,
      protections: [],
    }),
    [apiKey.id, apiKey.name]
  )

  const createMutation = useMutation(queries.guardrails.create())
  const updateMutation = useMutation(queries.guardrails.update())
  const deleteMutation = useMutation(queries.guardrails.delete())

  const toPolicyDto = (policy: GuardrailPolicy) => ({
    name: policy.name,
    scope: policy.scope,
    target: policy.target,
    protections: policy.protections,
    enabled: policy.enabled,
    config: policy.config,
  })

  const handleSave = (policy: GuardrailPolicy) => {
    const isDraft = policy.id === 'draft'
    const options = {
      onSuccess: () => {
        setDialog(null)
        toast.success(isDraft ? 'Key override created' : 'Key override saved')
      },
      onError: toastAxiosError,
    }

    if (isDraft) {
      createMutation.mutate(toPolicyDto(policy), options)
    } else {
      updateMutation.mutate({ id: policy.id, reqBody: toPolicyDto(policy) }, options)
    }
  }

  const handleToggle = (policy: GuardrailPolicy) => {
    updateMutation.mutate(
      { id: policy.id, reqBody: toPolicyDto({ ...policy, enabled: !policy.enabled }) },
      {
        onSuccess: () => toast.success('Key override updated'),
        onError: toastAxiosError,
      }
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteId(null)
        toast.success('Key override deleted')
      },
      onError: toastAxiosError,
    })
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  const stats = statsQuery.data
  const figure = (value: number) => (
    <span className="text-xl font-semibold tabular-nums">{stats ? formatCount(value) : '—'}</span>
  )
  const share = (value: number) =>
    stats && stats.requests > 0 ? `${Math.round((value / stats.requests) * 100)}%` : '0%'
  const note = (text: string) => (
    <span className="block text-xs text-muted-foreground tabular-nums">{stats ? text : ' '}</span>
  )

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="key-guardrails-window" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <IconChartBar className="text-primary size-4" aria-hidden />
            <div>
              <h2 id="key-guardrails-window" className="text-[13px] font-semibold">
                Last {stats?.days ?? 7} days
              </h2>
              <p className="text-xs text-muted-foreground">
                What the guardrails did to this key&apos;s traffic
              </p>
            </div>
          </div>
          <Link
            to="/guardrails"
            className="text-primary rounded-sm text-[12.5px] font-medium hover:underline"
          >
            Open guardrails
          </Link>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <Stat icon={IconBan} label="Blocked">
            {figure(stats?.blocked ?? 0)}
            {note(`${share(stats?.blocked ?? 0)} of ${formatCount(stats?.requests ?? 0)} requests`)}
          </Stat>
          <Stat icon={IconEyeOff} label="Masked">
            {figure(stats?.masked ?? 0)}
            {note(share(stats?.masked ?? 0))}
          </Stat>
          <Stat icon={IconAlertTriangle} label="Warned">
            {figure(stats?.warned ?? 0)}
            {note(`${formatCount(stats?.logged ?? 0)} log only`)}
          </Stat>
        </dl>
      </section>

      <SectionCardPanel
        icon={IconShieldCheck}
        title="Per-key override"
        toolbar={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog({ policy: draftPolicy, mode: 'create' })}
          >
            Create override
          </Button>
        }
      >
        <div className="divide-y divide-border">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium">Status</p>
              <p className="text-xs text-muted-foreground">
                {keyPolicies.length > 0
                  ? 'This key adds its own layer on top of global, provider, model and chain policies'
                  : 'Global, provider, model and chain policies apply'}
              </p>
            </div>
            <Pill tone={keyPolicies.length > 0 ? 'active' : 'muted'}>
              {keyPolicies.length > 0 ? 'Override' : 'Inherited'}
            </Pill>
          </div>

          {keyPolicies.map((policy) => (
            <div key={policy.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-medium" title={policy.name}>
                    {policy.name}
                  </p>
                  <Pill tone={policy.enabled ? 'active' : 'muted'}>
                    {policy.enabled ? 'Active' : 'Disabled'}
                  </Pill>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {policy.protections.length > 0
                    ? policy.protections.join(' · ')
                    : 'No detectors enabled'}
                </p>
              </div>
              <Switch
                aria-label={`Toggle ${policy.name}`}
                checked={policy.enabled}
                disabled={updateMutation.isPending}
                onCheckedChange={() => handleToggle(policy)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog({ policy, mode: 'edit' })}
              >
                Edit
              </Button>
              <Button
                aria-label={`Delete ${policy.name}`}
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setDeleteId(policy.id)}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </SectionCardPanel>

      <SectionCardPanel icon={IconShield} title="Effective protection">
        <div className="px-4 py-3">
          {activeDetectors.length === 0 ? (
            <Pill tone="muted">No detectors active</Pill>
          ) : (
            <ul className="flex flex-wrap items-center gap-1.5">
              {activeDetectors.map((detector) => (
                <li key={detector.key}>
                  <Pill tone="active">{detector.label}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Collapsible open={mergedOpen} onOpenChange={setMergedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between border-t border-border px-4 py-2.5 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Merged configuration
              <IconChevronDown
                className={cn('size-4 transition-transform', mergedOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y divide-border border-t border-border">
              {effective.map((detector) => (
                <li key={detector.key} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{detector.label}</p>
                    <Pill tone={detector.enabled ? 'active' : 'muted'}>
                      {detector.enabled ? 'Enabled' : 'Off'}
                    </Pill>
                    <span className="text-xs text-muted-foreground">
                      {detector.source === 'key'
                        ? 'key override'
                        : detector.source === 'inherited'
                          ? 'inherited'
                          : 'not configured'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {describeConfig(detector.config)}
                  </p>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </SectionCardPanel>

      <EditPolicyDialog
        mode={dialog?.mode ?? 'create'}
        policy={dialog?.policy ?? null}
        targetLocked
        onOpenChange={(open) => !open && setDialog(null)}
        onSave={handleSave}
      />

      <SimpleAlertDialog
        confirmText="Delete"
        description="This removes the key-specific guardrail layer. Upstream global, provider, model, and chain policies keep applying."
        open={deleteId !== null}
        title="Delete this key override?"
        variant="destructive"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      />
    </div>
  )
}

const PILL_TONE = {
  active:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400',
  muted: 'border border-border bg-muted/40 text-muted-foreground',
}

function Pill({ tone, children }: { tone: keyof typeof PILL_TONE; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium',
        PILL_TONE[tone]
      )}
    >
      {children}
    </span>
  )
}

/**
 * Resolves the detectors that apply to a key.
 *
 * This mirrors the server's `guardrails.Merge`, which the gateway enforces: layers are
 * walked most-specific-first, a detector counts as active if ANY applicable
 * layer enables it (a key override cannot switch off upstream protection), and
 * the settings shown come from the most specific layer that enables it.
 */
function mergeDetectors(
  keyPolicies: GuardrailPolicy[],
  upstreamPolicies: GuardrailPolicy[]
): EffectiveDetector[] {
  // Most specific first: key, chain, model, provider, global.
  const layers = [...keyPolicies, ...sortBySpecificity(upstreamPolicies)]

  return DETECTORS.map((detector) => {
    let config: { enabled?: boolean } | undefined
    let source: EffectiveDetector['source'] = 'off'
    let enabled = false

    for (const policy of layers) {
      const section = policy.config?.[detector.key]
      // A policy saved without a config document still names its detectors.
      const named = policy.protections.some((protection) =>
        detector.aliases.includes(protection.toLowerCase() as never)
      )

      if (section?.enabled) {
        enabled = true
        if (!config) {
          config = section
          source = policy.scope === 'key' ? 'key' : 'inherited'
        }
      } else if (named) {
        enabled = true
        if (!config) source = policy.scope === 'key' ? 'key' : 'inherited'
      }
    }

    return {
      key: detector.key,
      label: detector.label,
      enabled,
      source: enabled ? source : 'off',
      config: config as Record<string, unknown> | undefined,
    }
  })
}

/** Orders policies by scope specificity, most specific first. */
function sortBySpecificity(policies: GuardrailPolicy[]) {
  return [...policies].sort(
    (a, b) => SPECIFICITY_ORDER.indexOf(a.scope) - SPECIFICITY_ORDER.indexOf(b.scope)
  )
}

function describeConfig(config?: Record<string, unknown>) {
  if (!config) return 'no configuration saved'

  const parts = Object.entries(config)
    .filter(([key, value]) => key !== 'enabled' && !isEmpty(value))
    .map(
      ([key, value]) =>
        `${humanize(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`
    )

  return parts.length > 0 ? parts.join(' · ') : 'defaults'
}

function isEmpty(value: unknown) {
  if (value === undefined || value === null || value === '') return true
  return Array.isArray(value) && value.length === 0
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}
