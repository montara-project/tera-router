import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { BudgetScopeKind } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

const PERIODS = ['daily', 'weekly', 'monthly'] as const
const SCOPES = ['tenant', 'api_key', 'account'] as const

const BudgetFormSchema = z
  .object({
    scope_kind: z.enum(SCOPES),
    scope_id: z.string(),
    period: z.enum(PERIODS),
    budget_spend: z.string(),
    limit_tokens: z.string(),
    alert_pct: z.string(),
    hard_cutoff: z.boolean(),
  })
  .refine((value) => value.scope_kind === 'tenant' || value.scope_id !== '', {
    message: 'Pick the key or account this budget applies to.',
    path: ['scope_id'],
  })

export const SCOPE_LABELS: Record<BudgetScopeKind, string> = {
  tenant: 'Whole instance',
  api_key: 'API key',
  account: 'Provider account',
}

const SCOPE_OPTIONS: Option<BudgetScopeKind>[] = SCOPES.map((scope) => ({
  value: scope,
  label: SCOPE_LABELS[scope],
}))

const PERIOD_OPTIONS: Option<(typeof PERIODS)[number]>[] = PERIODS.map((period) => ({
  value: period,
  label: period.charAt(0).toUpperCase() + period.slice(1),
}))

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Budget to edit; omit for create mode. */
  budget?: Models.Budget | null
  /** Options for the api_key and account scopes. */
  scopeOptions: Record<'api_key' | 'account', Option<unknown>[]>
}

/** Create/edit dialog for one budget, keyed so every open starts fresh. */
export default function BudgetFormDialog(props: BudgetFormDialogProps) {
  return <BudgetForm key={`${props.budget?.id ?? 'new'}-${props.open}`} {...props} />
}

function BudgetForm({ open, onOpenChange, budget, scopeOptions }: BudgetFormDialogProps) {
  const editing = Boolean(budget?.id)

  const createMutation = useMutation(queries.budgets.create())
  const updateMutation = useMutation(queries.budgets.update(budget?.id ?? ''))

  const form = useAppForm({
    defaultValues: {
      scope_kind: budget?.scope_kind ?? ('tenant' as BudgetScopeKind),
      scope_id: budget?.scope_id ?? '',
      period: budget?.period ?? ('monthly' as (typeof PERIODS)[number]),
      // A stored 0 means "no limit"; show the placeholder instead.
      budget_spend: budget?.limit_micros ? String(budget.limit_micros / 1_000_000) : '',
      limit_tokens: budget?.limit_tokens ? String(budget.limit_tokens) : '',
      alert_pct: String(budget?.alert_pct ?? 80),
      hard_cutoff: budget?.hard_cutoff ?? false,
    },
    validators: {
      onSubmit: BudgetFormSchema,
    },
    onSubmit: async ({ value }) => {
      const payload = {
        scope_kind: value.scope_kind,
        scope_id: value.scope_kind === 'tenant' ? undefined : value.scope_id,
        period: value.period,
        // A cleared limit is sent as 0 (= unlimited): PATCH keeps omitted fields.
        budget_spend: parseLimit(value.budget_spend),
        limit_tokens: Math.round(parseLimit(value.limit_tokens)),
        alert_pct: Math.round(parseLimit(value.alert_pct)),
        hard_cutoff: value.hard_cutoff,
      }

      try {
        if (editing) {
          await updateMutation.mutateAsync(payload)
          toast.success('Budget updated')
        } else {
          await createMutation.mutateAsync(payload)
          toast.success('Budget created')
        }
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit Budget' : 'Create Budget'}
      description="Cap spend or tokens per period for the whole instance, one API key, or one provider account."
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      confirmText={editing ? 'Save changes' : 'Create budget'}
      loading={createMutation.isPending || updateMutation.isPending}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="scope_kind">
            {(field) => <field.SelectField label="Applies to" options={SCOPE_OPTIONS} />}
          </form.AppField>

          <form.Subscribe selector={(s) => s.values.scope_kind}>
            {(scope) =>
              scope === 'tenant' ? null : (
                <form.AppField name="scope_id">
                  {(field) => (
                    <field.SelectField
                      label={SCOPE_LABELS[scope]}
                      options={scopeOptions[scope]}
                      asterisk
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="period">
            {(field) => <field.SelectField label="Period" options={PERIOD_OPTIONS} />}
          </form.AppField>

          <form.AppField name="alert_pct">
            {(field) => (
              <field.NumberField label="Alert at (%)" placeholder="e.g. 80" decimalScale={0} />
            )}
          </form.AppField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="budget_spend">
            {(field) => (
              <field.NumberField label="Spend (USD)" placeholder="Unlimited" decimalScale={2} />
            )}
          </form.AppField>

          <form.AppField name="limit_tokens">
            {(field) => (
              <field.NumberField label="Tokens" placeholder="Unlimited" decimalScale={0} />
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
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** Empty/invalid input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}
