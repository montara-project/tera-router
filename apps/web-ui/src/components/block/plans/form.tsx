import {
  IconChevronDown,
  IconCpu,
  IconFileDescription,
  IconGauge,
  IconWallet,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { FieldLabel, ModelPatternPicker } from '@/components/block/keys/form'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { type PlanDto, PlanFormSchema, type PlanFormValues } from '@/lib/api/dtos/plan/schema'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

const PERIODS = ['daily', 'weekly', 'monthly'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_HINTS: Record<Period, string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Older rows may store an out-of-enum period; fall back to the server default. */
function formPeriod(period: string | undefined): Period {
  return period && (PERIODS as readonly string[]).includes(period) ? (period as Period) : 'monthly'
}

// Stored 0 means the limit was cleared (= unlimited); show the "Unlimited"
// placeholder instead of a meaningless zero.
const limitText = (value: number | null | undefined) => (value ? String(value) : '')

function valuesFrom(plan?: Models.Plan | null): PlanFormValues {
  return {
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    period: formPeriod(plan?.period),
    spend: limitText(plan?.budget_spend),
    tokens: limitText(plan?.budget_tokens),
    rpm: limitText(plan?.rpm),
    tpm: limitText(plan?.tpm),
    concurrent: limitText(plan?.concurrent),
    alert_pct: String(plan?.alert_at_percent ?? 80),
    hard_cutoff: plan?.hard_cutoff ?? true,
    models: plan?.allowed_models ?? [],
  }
}

/** Empty input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}

function toPayload(value: PlanFormValues): PlanDto {
  return {
    name: value.name.trim(),
    description: value.description.trim(),
    period: value.period,
    // The server PATCH treats an omitted/null field as "keep the stored
    // value", so a cleared limit is sent as 0 (= unlimited) instead.
    budget_spend: parseLimit(value.spend),
    budget_tokens: Math.round(parseLimit(value.tokens)),
    rpm: Math.round(parseLimit(value.rpm)),
    tpm: Math.round(parseLimit(value.tpm)),
    concurrent: Math.round(parseLimit(value.concurrent)),
    alert_at_percent: Number(value.alert_pct),
    hard_cutoff: value.hard_cutoff,
    allowed_models: value.models,
  }
}

/** A titled group inside the dialog body; groups after the first get a rule above. */
export function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 border-border pt-4 not-first:border-t first:pt-0">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className="size-4 text-orange-600 dark:text-orange-400" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

type AbstractFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: PlanFormValues
  mutation: {
    mutateAsync: (value: PlanDto) => Promise<unknown>
    isPending: boolean
  }
  isEdit?: boolean
}

const RATE_FIELDS = [
  { name: 'rpm', label: 'Requests / min' },
  { name: 'tpm', label: 'Tokens / min' },
  { name: 'concurrent', label: 'Concurrent requests' },
] as const

function AbstractForm({ open, onOpenChange, defaultValues, mutation, isEdit }: AbstractFormProps) {
  const id = useId()
  // Open on edit when the plan already has rate limits, so they are not hidden.
  const [advanced, setAdvanced] = useState(
    Boolean(defaultValues.rpm || defaultValues.tpm || defaultValues.concurrent)
  )

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: PlanFormSchema,
      onChange: PlanFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(toPayload(value))
        toast.success(isEdit ? 'Plan updated' : 'Plan created')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const periodHint = useSelector(form.store, (state) => PERIOD_HINTS[state.values.period])

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit plan' : 'Create plan'}
      description="Budget, rate and model limits that API keys on this plan inherit."
      confirmText={isEdit ? 'Save changes' : 'Create plan'}
      loading={mutation.isPending}
      size="lg"
    >
      <Section icon={IconFileDescription} title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField label="Name" placeholder="Pro" autoComplete="off" asterisk />
            )}
          />
          <form.AppField
            name="description"
            children={(field) => (
              <field.TextField
                label="Description"
                hint="Optional"
                placeholder="Full access, $100 a month"
                autoComplete="off"
              />
            )}
          />
        </div>
      </Section>

      <Section icon={IconWallet} title="Budget per key">
        <div className="grid gap-3 sm:grid-cols-3">
          <form.AppField
            name="spend"
            children={(field) => (
              <field.TextField
                label="Spend limit (USD)"
                hint={periodHint}
                inputMode="decimal"
                placeholder="Unlimited"
              />
            )}
          />
          <form.AppField
            name="tokens"
            children={(field) => (
              <field.TextField
                label="Token limit"
                hint={periodHint}
                inputMode="numeric"
                placeholder="Unlimited"
              />
            )}
          />
          <form.AppField
            name="period"
            children={(field) => (
              <field.SelectField label="Period" className="w-full" options={PERIOD_OPTIONS} />
            )}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <form.AppField
            name="alert_pct"
            children={(field) => <field.TextField label="Alert at (%)" inputMode="numeric" />}
          />
          <form.AppField
            name="hard_cutoff"
            children={(field) => (
              <div className="flex items-center justify-between gap-4 self-start rounded-md border border-border sm:mt-7 px-[13px] py-[11px] sm:col-span-2">
                <div className="min-w-0">
                  <label htmlFor={`${id}-cutoff`} className="block text-[12.5px] font-medium">
                    Hard cutoff
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Reject requests once a key reaches the limit.
                  </p>
                </div>
                <Switch
                  id={`${id}-cutoff`}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          />
        </div>
      </Section>

      <Section icon={IconCpu} title="Models">
        <form.AppField
          name="models"
          children={(field) => (
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-models`} label="Allowed models" hint="Optional" />
              <ModelPatternPicker
                id={`${id}-models`}
                value={field.state.value}
                onChange={field.handleChange}
              />
              <p className="text-xs text-muted-foreground">
                Empty allows every model. * wildcards work, e.g. claude-*.
              </p>
            </div>
          )}
        />
      </Section>

      <Section
        icon={IconGauge}
        title={
          <button
            type="button"
            aria-expanded={advanced}
            aria-controls={`${id}-rates`}
            onClick={() => setAdvanced((v) => !v)}
            className="flex flex-1 items-center justify-between gap-3 rounded-md"
          >
            Advanced: rate limits
            <IconChevronDown
              className={cn('size-4 text-muted-foreground', advanced && 'rotate-180')}
              aria-hidden
            />
          </button>
        }
      >
        {advanced ? (
          <div id={`${id}-rates`} className="grid gap-3 sm:grid-cols-3">
            {RATE_FIELDS.map((f) => (
              <form.AppField
                key={f.name}
                name={f.name}
                children={(field) => (
                  <field.TextField label={f.label} inputMode="numeric" placeholder="Unlimited" />
                )}
              />
            ))}
          </div>
        ) : null}
      </Section>
    </SimpleAlertScrollableDialogForm>
  )
}

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Plan to edit; omit (or pass null) for create mode. */
  plan?: Models.Plan | null
}

/**
 * Create/edit dialog for one plan. Keyed by plan id + open state so every
 * open starts from fresh values instead of the previous session's.
 */
export default function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  return plan?.id ? (
    <EditPlanForm key={`${plan.id}-${open}`} open={open} onOpenChange={onOpenChange} plan={plan} />
  ) : (
    <AddPlanForm key={`new-${open}`} open={open} onOpenChange={onOpenChange} />
  )
}

function AddPlanForm({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMutation(queries.plans.create())
  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={valuesFrom()}
      mutation={mutation}
    />
  )
}

function EditPlanForm({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Models.Plan
}) {
  const mutation = useMutation(queries.plans.update(plan.id))
  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={valuesFrom(plan)}
      mutation={mutation}
      isEdit
    />
  )
}
