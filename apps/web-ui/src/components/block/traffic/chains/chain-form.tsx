import {
  IconArrowDown,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconForms,
  IconLifebuoy,
  IconPlus,
  IconRoute,
  IconStack2,
  IconX,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { CHAIN_STRATEGY_OPTIONS, chainStrategyLabel } from '@/lib/constants/chain'
import { cn } from '@/lib/utils'

import ChainModelPicker, { useChainModelGroups } from './chain-model-picker'

/** Same rule as the server's dtos.ChainNamePattern. */
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/

type Step = { provider: string; model: string; active: boolean }

type Draft = {
  name: string
  strategy: string
  enabled: boolean
  contextWindow: string
  steps: Step[]
  fallbackOn: boolean
  fallback: { provider: string; model: string }
}

const EMPTY_STEP: Step = { provider: '', model: '', active: true }

function draftFrom(chain?: Models.Chain): Draft {
  return {
    name: chain?.name ?? '',
    strategy: chain?.strategy || 'priority',
    enabled: chain?.enabled ?? true,
    contextWindow: chain?.context_window ? String(chain.context_window) : '',
    steps: chain?.steps.length
      ? chain.steps.map((s) => ({ provider: s.provider, model: s.model, active: s.active ?? true }))
      : [EMPTY_STEP],
    fallbackOn: Boolean(chain?.fallback_model),
    fallback: { provider: chain?.fallback_provider ?? '', model: chain?.fallback_model ?? '' },
  }
}

/** The first thing stopping a save, or null when the draft can be saved. */
function blocker(d: Draft): string | null {
  const name = d.name.trim()
  if (!name) return 'Add a chain name to continue.'
  if (!NAME_PATTERN.test(name)) return 'Use only letters, numbers, dots, hyphens and underscores.'
  if (d.steps.length === 0) return 'Add at least one model.'
  if (d.steps.some((s) => !s.model)) return 'Choose a model for every step.'
  if (d.fallbackOn && !d.fallback.model) return 'Choose a final fallback model, or turn it off.'
  if (!d.steps.some((s) => s.active) && !d.fallbackOn) {
    return 'Turn on at least one step, or add a final fallback.'
  }
  return null
}

export default function ChainForm({ chain }: { chain?: Models.Chain }) {
  const editing = Boolean(chain)
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => draftFrom(chain))
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setStep = (i: number, patch: Partial<Step>) =>
    set({ steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const moveStep = (from: number, to: number) => {
    const steps = [...draft.steps]
    const [step] = steps.splice(from, 1)
    steps.splice(to, 0, step)
    set({ steps })
  }

  const { groups, apiKinds, loading } = useChainModelGroups()
  const createMutation = useMutation(queries.chains.create())
  const updateMutation = useMutation(queries.chains.update(chain?.id ?? ''))
  const saving = createMutation.isPending || updateMutation.isPending

  const nameId = useId()
  const nameHintId = useId()
  const blocked = blocker(draft)
  const nameInvalid = draft.name.trim() !== '' && !NAME_PATTERN.test(draft.name.trim())
  const strategy = CHAIN_STRATEGY_OPTIONS.find((o) => o.value === draft.strategy)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (blocked) return
    const payload = {
      name: draft.name.trim(),
      strategy: draft.strategy,
      enabled: draft.enabled,
      context_window: Number(draft.contextWindow) || 0,
      fallback_provider: draft.fallbackOn ? draft.fallback.provider : '',
      fallback_model: draft.fallbackOn ? draft.fallback.model : '',
      steps: draft.steps,
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync(payload)
        toast.success(`Chain ${payload.name} saved`)
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(`Chain ${payload.name} created`)
      }
      void navigate({ to: '/chains' })
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[13px]">
          <li>
            <Link
              to="/chains"
              className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <IconStack2 className="size-3.5" aria-hidden />
              Chains
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground/70">
            /
          </li>
          <li aria-current="page" className="truncate">
            {editing ? chain?.name : 'New chain'}
          </li>
        </ol>
      </nav>

      <PageHeader
        icon={IconStack2}
        iconClassName="text-primary border-transparent bg-primary/10"
        title={editing ? 'Edit chain' : 'Create chain'}
      />

      <div className="mt-1 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <DashboardPanel title="Name and strategy" icon={IconForms}>
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={nameId} className="text-[13px] font-medium">
                    Chain name
                  </label>
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
                <Input
                  id={nameId}
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="production-fallback"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={nameInvalid || undefined}
                  aria-describedby={nameHintId}
                />
                <p
                  id={nameHintId}
                  className={cn(
                    'text-xs',
                    nameInvalid ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  Letters, numbers, dots, hyphens and underscores.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Routing strategy</span>
                <SegmentedControl
                  aria-label="Routing strategy"
                  className="max-w-full self-start overflow-x-auto"
                  value={draft.strategy}
                  onChange={(value) => set({ strategy: value })}
                  options={CHAIN_STRATEGY_OPTIONS.map(({ value, label, icon }) => ({
                    value: value as string,
                    label,
                    icon,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  {strategy?.description ??
                    `Stored as "${draft.strategy}". Models run in the order listed.`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${nameId}-ctx`} className="text-[13px] font-medium">
                    Context window{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id={`${nameId}-ctx`}
                    inputMode="numeric"
                    value={draft.contextWindow}
                    onChange={(e) => set({ contextWindow: e.target.value.replace(/\D/g, '') })}
                    placeholder="128000"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 self-end rounded-md border border-border px-3 py-2">
                  <span className="text-[13px]">
                    Enabled
                    <span className="block text-xs text-muted-foreground">
                      Off stops routing through this chain.
                    </span>
                  </span>
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(enabled) => set({ enabled })}
                    aria-label="Chain enabled"
                  />
                </div>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Route steps" icon={IconRoute}>
            <ol className="divide-y divide-border">
              {draft.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 sm:flex-nowrap"
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                      step.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </span>
                  <ChainModelPicker
                    label={`Step ${i + 1} model`}
                    value={step}
                    onChange={(target) => setStep(i, target)}
                    groups={groups}
                    apiKinds={apiKinds}
                    loading={loading}
                    className={cn('flex-1 basis-48', !step.active && 'opacity-60')}
                  />
                  <span className="ms-auto flex shrink-0 items-center gap-0.5">
                    <Switch
                      size="sm"
                      className="me-1.5"
                      checked={step.active}
                      onCheckedChange={(active) => setStep(i, { active })}
                      aria-label={`Step ${i + 1} on`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Move step ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => moveStep(i, i - 1)}
                    >
                      <IconChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Move step ${i + 1} down`}
                      disabled={i === draft.steps.length - 1}
                      onClick={() => moveStep(i, i + 1)}
                    >
                      <IconChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() => set({ steps: draft.steps.filter((_, j) => j !== i) })}
                    >
                      <IconX className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            <div className="border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => set({ steps: [...draft.steps, EMPTY_STEP] })}
              >
                <IconPlus />
                Add model
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <IconLifebuoy className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">Final fallback</span>
                  <span className="block text-xs text-muted-foreground">
                    Tried last, after every step fails.
                  </span>
                </span>
                <Switch
                  checked={draft.fallbackOn}
                  onCheckedChange={(fallbackOn) => set({ fallbackOn })}
                  aria-label="Final fallback"
                />
              </div>
              {draft.fallbackOn && (
                <ChainModelPicker
                  label="Final fallback model"
                  value={draft.fallback}
                  onChange={(fallback) => set({ fallback })}
                  groups={groups}
                  apiKinds={apiKinds}
                  loading={loading}
                />
              )}
            </div>
          </DashboardPanel>
        </div>

        <RoutePreview draft={draft} apiKinds={apiKinds} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-5 py-3">
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          {blocked ?? (editing ? 'Ready to save.' : 'Ready to create.')}
        </p>
        <Button type="submit" disabled={Boolean(blocked) || saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create chain'}
        </Button>
      </div>
    </form>
  )
}

function RoutePreview({ draft, apiKinds }: { draft: Draft; apiKinds: Map<string, string> }) {
  const { copy, copied } = useCopyToClipboard()
  const chosen = draft.steps.filter((s) => s.model)
  const fallback = draft.fallbackOn && draft.fallback.model ? draft.fallback : null
  const target = `chain:${draft.name.trim() || 'your-chain'}`
  const route = [
    ...chosen.map((s) => ({ ...s, kind: 'step' as const })),
    ...(fallback ? [{ ...fallback, active: true, kind: 'fallback' as const }] : []),
  ]

  return (
    <DashboardPanel
      title="Route preview"
      description={`${chainStrategyLabel(draft.strategy)} · ${chosen.length} ${chosen.length === 1 ? 'model' : 'models'}`}
      icon={IconRoute}
      className="lg:sticky lg:top-4"
    >
      <div className="p-4">
        {route.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-3 py-5 text-center">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconRoute className="size-4" aria-hidden />
            </span>
            <p className="text-[13px] text-muted-foreground">Choose a model to see the route.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {route.map((s, i) => (
              <li key={`${s.kind}-${i}`} className="flex flex-col gap-1">
                {i > 0 && (
                  <IconArrowDown className="ms-1.5 size-3.5 text-muted-foreground" aria-hidden />
                )}
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-md border border-border px-2 py-1.5',
                    !s.active && 'border-dashed opacity-60'
                  )}
                >
                  <ProviderAvatar slug={s.provider} apiKind={apiKinds.get(s.provider)} size="xs" />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={`${s.provider}/${s.model}`}
                  >
                    {s.provider}/{s.model}
                  </span>
                  {s.kind === 'fallback' ? (
                    <span className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400">
                      Fallback
                    </span>
                  ) : (
                    !s.active && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">Off</span>
                    )
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Model target</p>
          <p className="truncate font-mono text-[13px]" title={target}>
            {target}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!draft.name.trim()}
          aria-label={copied ? `${target} copied` : `Copy ${target}`}
          onClick={() => copy(target)}
        >
          {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
        </Button>
      </div>
    </DashboardPanel>
  )
}
