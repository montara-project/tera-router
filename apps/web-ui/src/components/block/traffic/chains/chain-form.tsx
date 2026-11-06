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
import { useSelector } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SegmentedControl from '@/components/block/common/segmented-control'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { type ChainDto, ChainFormSchema, type ChainFormValues } from '@/lib/api/dtos/chain/schema'
import { queries } from '@/lib/api/queries'
import { CHAIN_STRATEGY_OPTIONS, chainStrategyLabel } from '@/lib/constants/chain'
import { cn } from '@/lib/utils'

import ChainModelPicker, { useChainModelGroups } from './chain-model-picker'

type Step = ChainFormValues['steps'][number]

const EMPTY_STEP: Step = { provider: '', model: '', active: true }

function valuesFrom(chain?: Models.Chain): ChainFormValues {
  return {
    name: chain?.name ?? '',
    strategy: chain?.strategy || 'priority',
    enabled: chain?.enabled ?? true,
    context_window: chain?.context_window ? String(chain.context_window) : '',
    steps: chain?.steps.length
      ? chain.steps.map((s) => ({ provider: s.provider, model: s.model, active: s.active ?? true }))
      : [EMPTY_STEP],
    fallback_on: Boolean(chain?.fallback_model),
    fallback: { provider: chain?.fallback_provider ?? '', model: chain?.fallback_model ?? '' },
  }
}

function toPayload(value: ChainFormValues): ChainDto {
  return {
    name: value.name.trim(),
    strategy: value.strategy,
    enabled: value.enabled,
    context_window: Number(value.context_window) || 0,
    fallback_provider: value.fallback_on ? value.fallback.provider : '',
    fallback_model: value.fallback_on ? value.fallback.model : '',
    steps: value.steps,
  }
}

/** First message of a field's errors (zod issues or plain strings). */
const errorText = (errors: unknown[] | undefined) => {
  const first = errors?.[0]
  return typeof first === 'string' ? first : (first as { message?: string } | undefined)?.message
}

type AbstractFormProps = {
  defaultValues: ChainFormValues
  mutation: {
    mutateAsync: (value: ChainDto) => Promise<unknown>
    isPending: boolean
  }
  isEdit?: boolean
  /** Name shown in the breadcrumb while editing. */
  title?: string
}

/** /chains/new and /chains/$chainId. */
export default function ChainForm({ chain }: { chain?: Models.Chain }) {
  return chain ? <EditChainForm chain={chain} /> : <CreateChainForm />
}

function CreateChainForm() {
  const mutation = useMutation(queries.chains.create())
  return <AbstractForm defaultValues={valuesFrom()} mutation={mutation} />
}

function EditChainForm({ chain }: { chain: Models.Chain }) {
  const mutation = useMutation(queries.chains.update(chain.id))
  return (
    <AbstractForm defaultValues={valuesFrom(chain)} mutation={mutation} isEdit title={chain.name} />
  )
}

function AbstractForm({ defaultValues, mutation, isEdit, title }: AbstractFormProps) {
  const navigate = useNavigate()
  const { groups, apiKinds, loading } = useChainModelGroups()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ChainFormSchema,
      onChange: ChainFormSchema,
    },
    onSubmit: async ({ value }) => {
      const payload = toPayload(value)
      try {
        await mutation.mutateAsync(payload)
        toast.success(`Chain ${payload.name} ${isEdit ? 'saved' : 'created'}`)
        void navigate({ to: '/chains' })
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const values = useSelector(form.store, (state) => state.values)
  // The first problem anywhere in the form, shown next to the submit button.
  const blocked = useSelector(form.store, (state) =>
    errorText(Object.values(state.fieldMeta).flatMap((meta) => meta?.errors ?? []))
  )
  const strategy = CHAIN_STRATEGY_OPTIONS.find((o) => o.value === values.strategy)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-3"
    >
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
            {isEdit ? title : 'New chain'}
          </li>
        </ol>
      </nav>

      <PageHeader icon={IconStack2} title={isEdit ? 'Edit chain' : 'Create chain'} />

      <div className="mt-1 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCardPanel title="Name and strategy" icon={IconForms}>
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-1.5">
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.TextField
                      label="Chain name"
                      asterisk
                      placeholder="production-fallback"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, dots, hyphens and underscores.
                </p>
              </div>

              <form.AppField
                name="strategy"
                children={(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-medium">Routing strategy</span>
                    <SegmentedControl
                      aria-label="Routing strategy"
                      className="max-w-full self-start overflow-x-auto"
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={CHAIN_STRATEGY_OPTIONS.map(({ value, label, icon }) => ({
                        value: value as string,
                        label,
                        icon,
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      {strategy?.description ??
                        `Stored as "${field.state.value}". Models run in the order listed.`}
                    </p>
                  </div>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <form.AppField
                  name="context_window"
                  children={(field) => (
                    <field.NumberField
                      label="Context window"
                      hint="Optional"
                      placeholder="128,000"
                    />
                  )}
                />
                <form.AppField
                  name="enabled"
                  children={(field) => (
                    <div className="flex items-center justify-between gap-3 self-start rounded-md border border-border px-3 py-2 sm:mt-7">
                      <span className="text-[13px]">
                        Enabled
                        <span className="block text-xs text-muted-foreground">
                          Off stops routing through this chain.
                        </span>
                      </span>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-label="Chain enabled"
                      />
                    </div>
                  )}
                />
              </div>
            </div>
          </SectionCardPanel>

          <SectionCardPanel title="Route steps" icon={IconRoute}>
            <form.AppField
              name="steps"
              children={(field) => {
                const steps = field.state.value
                const setStep = (i: number, patch: Partial<Step>) =>
                  field.handleChange((current) =>
                    current.map((s, j) => (j === i ? { ...s, ...patch } : s))
                  )
                const moveStep = (from: number, to: number) =>
                  field.handleChange((current) => {
                    const next = [...current]
                    const [step] = next.splice(from, 1)
                    next.splice(to, 0, step)
                    return next
                  })
                const error = errorText(field.state.meta.errors)

                return (
                  <>
                    <ol className="divide-y divide-border">
                      {steps.map((step, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 sm:flex-nowrap"
                        >
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                              step.active
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
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
                              disabled={i === steps.length - 1}
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
                              onClick={() =>
                                field.handleChange((current) => current.filter((_, j) => j !== i))
                              }
                            >
                              <IconX className="size-4" />
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                      {error ? (
                        <p role="alert" className="text-xs text-destructive">
                          {error}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => field.handleChange((current) => [...current, EMPTY_STEP])}
                      >
                        <IconPlus />
                        Add model
                      </Button>
                    </div>
                  </>
                )
              }}
            />
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
                <form.AppField
                  name="fallback_on"
                  children={(field) => (
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      aria-label="Final fallback"
                    />
                  )}
                />
              </div>
              {values.fallback_on && (
                <form.AppField
                  name="fallback"
                  children={(field) => {
                    const error = errorText(field.state.meta.errors)
                    return (
                      <>
                        <ChainModelPicker
                          label="Final fallback model"
                          value={field.state.value}
                          onChange={field.handleChange}
                          groups={groups}
                          apiKinds={apiKinds}
                          loading={loading}
                        />
                        {error ? (
                          <p role="alert" className="text-xs text-destructive">
                            {error}
                          </p>
                        ) : null}
                      </>
                    )
                  }}
                />
              )}
            </div>
          </SectionCardPanel>
        </div>

        <RoutePreview values={values} apiKinds={apiKinds} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-5 py-3">
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          {blocked ?? (isEdit ? 'Ready to save.' : 'Ready to create.')}
        </p>
        <Button type="submit" disabled={Boolean(blocked) || mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create chain'}
        </Button>
      </div>
    </form>
  )
}

function RoutePreview({
  values,
  apiKinds,
}: {
  values: ChainFormValues
  apiKinds: Map<string, string>
}) {
  const draft = { ...values, fallbackOn: values.fallback_on }
  const { copy, copied } = useCopyToClipboard()
  const chosen = draft.steps.filter((s) => s.model)
  const fallback = draft.fallbackOn && draft.fallback.model ? draft.fallback : null
  const target = `chain:${draft.name.trim() || 'your-chain'}`
  const route = [
    ...chosen.map((s) => ({ ...s, kind: 'step' as const })),
    ...(fallback ? [{ ...fallback, active: true, kind: 'fallback' as const }] : []),
  ]

  return (
    <SectionCardPanel
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
    </SectionCardPanel>
  )
}
