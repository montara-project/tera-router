import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { requiredString } from '@/lib/validation'

const PERIODS = ['daily', 'weekly', 'monthly'] as const

const PlanFormSchema = z.object({
  name: requiredString('name'),
  description: z.string(),
  period: z.enum(PERIODS),
  budget_spend: z.string(),
  budget_tokens: z.string(),
  rpm: z.string(),
  tpm: z.string(),
  concurrent: z.string(),
  alert_at_percent: z.string(),
  hard_cutoff: z.boolean(),
  allowed_models: z.string(),
})

const PERIOD_OPTIONS: Option<(typeof PERIODS)[number]>[] = PERIODS.map((period) => ({
  value: period,
  label: period.charAt(0).toUpperCase() + period.slice(1),
}))

const sectionLabel = 'text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase'

/** Older rows may store an out-of-enum period; fall back to the server default. */
function formPeriod(period: string | undefined): (typeof PERIODS)[number] {
  return period && (PERIODS as readonly string[]).includes(period)
    ? (period as (typeof PERIODS)[number])
    : 'monthly'
}

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Plan to edit; omit (or pass null) for create mode. */
  plan?: Models.Plan | null
}

/**
 * Create/edit dialog for one plan. The form is keyed by plan id + open state
 * so every open starts from fresh defaults instead of the previous session's
 * values.
 */
export default function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  return (
    <PlanForm
      key={`${plan?.id ?? 'new'}-${open}`}
      open={open}
      plan={plan}
      onOpenChange={onOpenChange}
    />
  )
}

interface PlanFormProps {
  open: boolean
  plan?: Models.Plan | null
  onOpenChange: (open: boolean) => void
}

function PlanForm({ open, plan, onOpenChange }: PlanFormProps) {
  const editing = Boolean(plan?.id)

  const createMutation = useMutation(queries.plans.create())
  const updateMutation = useMutation(queries.plans.update(plan?.id ?? ''))

  const form = useAppForm({
    defaultValues: {
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      period: formPeriod(plan?.period),
      // Stored 0 means the limit was cleared (= unlimited); show the
      // "Unlimited" placeholder instead of a meaningless zero.
      budget_spend: plan?.budget_spend ? String(plan.budget_spend) : '',
      budget_tokens: plan?.budget_tokens ? String(plan.budget_tokens) : '',
      rpm: plan?.rpm ? String(plan.rpm) : '',
      tpm: plan?.tpm ? String(plan.tpm) : '',
      concurrent: plan?.concurrent ? String(plan.concurrent) : '',
      alert_at_percent: String(plan?.alert_at_percent ?? 80),
      hard_cutoff: plan?.hard_cutoff ?? false,
      allowed_models: (plan?.allowed_models ?? []).join('\n'),
    },
    validators: {
      onSubmit: PlanFormSchema,
    },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name.trim() || 'Plan',
        description: value.description.trim(),
        period: value.period,
        // The server PATCH treats an omitted/null field as "keep the stored
        // value", so a cleared limit is sent as 0 (= unlimited) instead.
        budget_spend: parseLimit(value.budget_spend),
        budget_tokens: Math.round(parseLimit(value.budget_tokens)),
        rpm: Math.round(parseLimit(value.rpm)),
        tpm: Math.round(parseLimit(value.tpm)),
        concurrent: Math.round(parseLimit(value.concurrent)),
        alert_at_percent: Math.round(parseLimit(value.alert_at_percent)),
        hard_cutoff: value.hard_cutoff,
        allowed_models: parseAllowedModels(value.allowed_models),
      }

      try {
        if (editing) {
          await updateMutation.mutateAsync(payload)
          toast.success('Plan updated')
        } else {
          await createMutation.mutateAsync(payload)
          toast.success('Plan created')
        }
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit Plan' : 'Create Plan'}
      description="Reusable template for API key budget limits, rate limits, and model restrictions."
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      confirmText={editing ? 'Save changes' : 'Create plan'}
      loading={saving}
      size="lg"
    >
      <div className="space-y-5">
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" asterisk placeholder="e.g. Pro tier" />}
        </form.AppField>

        <form.AppField name="description">
          {(field) => <field.TextField label="Description" placeholder="What this plan is for" />}
        </form.AppField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="period">
            {(field) => <field.SelectField label="Period" options={PERIOD_OPTIONS} />}
          </form.AppField>

          <form.AppField name="alert_at_percent">
            {(field) => (
              <field.NumberField label="Alert at (%)" placeholder="e.g. 80" decimalScale={0} />
            )}
          </form.AppField>
        </div>

        <form.AppField name="hard_cutoff">
          {(field) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3.5 py-3">
              <div>
                <p className="text-sm font-medium">Hard cutoff</p>
                <p className="text-muted-foreground text-xs">
                  Block requests once the budget is exhausted instead of only alerting.
                </p>
              </div>
              <Switch
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
                onBlur={field.handleBlur}
                aria-label="Enable hard cutoff"
              />
            </div>
          )}
        </form.AppField>

        <div className="space-y-3">
          <p className={sectionLabel}>Budget</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.AppField name="budget_spend">
              {(field) => (
                <field.NumberField label="Spend (USD)" placeholder="Unlimited" decimalScale={2} />
              )}
            </form.AppField>

            <form.AppField name="budget_tokens">
              {(field) => (
                <field.NumberField label="Tokens" placeholder="Unlimited" decimalScale={0} />
              )}
            </form.AppField>
          </div>
        </div>

        <div className="space-y-3">
          <p className={sectionLabel}>Rate limits · Per key</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <form.AppField name="rpm">
              {(field) => (
                <field.NumberField label="RPM" placeholder="Unlimited" decimalScale={0} />
              )}
            </form.AppField>

            <form.AppField name="tpm">
              {(field) => (
                <field.NumberField label="TPM" placeholder="Unlimited" decimalScale={0} />
              )}
            </form.AppField>

            <form.AppField name="concurrent">
              {(field) => (
                <field.NumberField label="Concurrent" placeholder="Unlimited" decimalScale={0} />
              )}
            </form.AppField>
          </div>
        </div>

        <form.AppField name="allowed_models">
          {(field) => (
            <field.TextareaField
              label="Allowed models"
              note="One model id per line. Leave empty to allow all models."
              placeholder={'openai/gpt-4o\nanthropic/claude-sonnet-4'}
              rows={4}
            />
          )}
        </form.AppField>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** Empty/invalid input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Newline/comma separated model ids, trimmed and deduped; [] clears the restriction. */
function parseAllowedModels(raw: string): string[] {
  const models = raw
    .split(/[\n,]/)
    .map((model) => model.trim())
    .filter((model) => model !== '')

  return [...new Set(models)]
}
