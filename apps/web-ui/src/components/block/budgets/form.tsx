import { IconTarget, IconWallet } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BudgetScopeKind } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import { Section } from '@/components/block/plans/form'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  type BudgetDto,
  BudgetFormSchema,
  type BudgetFormValues,
} from '@/lib/api/dtos/budget/schema'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

export const SCOPE_LABELS: Record<BudgetScopeKind, string> = {
  tenant: 'Whole instance',
  api_key: 'API key',
  account: 'Provider account',
}

/** Label of the second "Applies to" field, and what the cutoff stops. */
const SCOPE_TARGET: Record<BudgetScopeKind, { field: string; noun: string }> = {
  tenant: { field: '', noun: 'the instance' },
  api_key: { field: 'Key', noun: 'the key' },
  account: { field: 'Account', noun: 'the account' },
}

const SCOPE_OPTIONS = (Object.keys(SCOPE_LABELS) as BudgetScopeKind[]).map((kind) => ({
  value: kind,
  label: SCOPE_LABELS[kind],
}))

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Empty input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}

function valuesFrom(budget?: Models.Budget | null): BudgetFormValues {
  return {
    scope_kind: budget?.scope_kind ?? 'api_key',
    scope_id: budget?.scope_id ?? '',
    period: budget?.period ?? 'monthly',
    // A stored 0 means "no limit"; show the placeholder instead.
    spend: budget?.limit_micros ? String(budget.limit_micros / 1_000_000) : '',
    tokens: budget?.limit_tokens ? String(budget.limit_tokens) : '',
    alert_pct: String(budget?.alert_pct ?? 80),
    hard_cutoff: budget?.hard_cutoff ?? true,
  }
}

function toPayload(value: BudgetFormValues): BudgetDto {
  return {
    scope_kind: value.scope_kind,
    scope_id: value.scope_kind === 'tenant' ? undefined : value.scope_id,
    period: value.period,
    // A cleared limit is sent as 0 (= unlimited): PATCH keeps omitted fields.
    budget_spend: parseLimit(value.spend),
    limit_tokens: Math.round(parseLimit(value.tokens)),
    alert_pct: Number(value.alert_pct),
    hard_cutoff: value.hard_cutoff,
  }
}

type ScopeOptions = Record<'api_key' | 'account', Option<unknown>[]>

type AbstractFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: BudgetFormValues
  scopeOptions: ScopeOptions
  mutation: {
    mutateAsync: (value: BudgetDto) => Promise<unknown>
    isPending: boolean
  }
  isEdit?: boolean
}

function AbstractForm({
  open,
  onOpenChange,
  defaultValues,
  scopeOptions,
  mutation,
  isEdit,
}: AbstractFormProps) {
  const id = useId()
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: BudgetFormSchema,
      onChange: BudgetFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(toPayload(value))
        toast.success(isEdit ? 'Budget updated' : 'Budget created')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const scopeKind = useSelector(form.store, (state) => state.values.scope_kind)
  const scopeId = useSelector(form.store, (state) => state.values.scope_id)
  const target = SCOPE_TARGET[scopeKind]
  const options = scopeKind === 'tenant' ? [] : scopeOptions[scopeKind]

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit budget' : 'New budget'}
      description="Cap spend or tokens per period for the whole instance, one API key or one provider account."
      confirmText={isEdit ? 'Save changes' : 'Create budget'}
      loading={mutation.isPending}
      size="lg"
    >
      <Section icon={IconTarget} title="Applies to">
        <div className="grid gap-3 sm:grid-cols-2">
          <form.AppField
            name="scope_kind"
            // A target picked for one scope means nothing for another.
            listeners={{ onChange: () => form.setFieldValue('scope_id', '') }}
            children={(field) => (
              <field.SelectField label="Scope" className="w-full" options={SCOPE_OPTIONS} />
            )}
          />
          {scopeKind === 'tenant' ? (
            <p className="self-end pb-2 text-xs text-muted-foreground">
              Counts every request through this instance.
            </p>
          ) : (
            <form.AppField
              name="scope_id"
              children={(field) => (
                <field.SelectField
                  label={target.field}
                  asterisk
                  placeholder={`Select ${target.field.toLowerCase()}…`}
                  className="w-full"
                  options={[
                    // The stored key or account may be gone; keep its id selectable.
                    ...(scopeId && !options.some((o) => String(o.value) === scopeId)
                      ? [{ value: scopeId, label: `${scopeId} (not found)` }]
                      : []),
                    ...options.map((o) => ({ value: String(o.value), label: String(o.label) })),
                  ]}
                />
              )}
            />
          )}
        </div>
      </Section>

      <Section icon={IconWallet} title="Limit">
        <div className="grid gap-3 sm:grid-cols-3">
          <form.AppField
            name="spend"
            children={(field) => (
              <field.NumberField label="Spend limit (USD)" currency placeholder="Unlimited" />
            )}
          />
          <form.AppField
            name="tokens"
            children={(field) => <field.NumberField label="Token limit" placeholder="Unlimited" />}
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
            children={(field) => <field.NumberField label="Alert at (%)" max={100} />}
          />
          <form.AppField
            name="hard_cutoff"
            children={(field) => (
              <div className="flex items-center justify-between gap-4 self-start rounded-md border border-border px-[13px] py-[11px] sm:col-span-2 sm:mt-7">
                <div className="min-w-0">
                  <label htmlFor={`${id}-cutoff`} className="block text-[12.5px] font-medium">
                    Hard cutoff
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Reject requests once {target.noun} reaches the limit.
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
    </SimpleAlertScrollableDialogForm>
  )
}

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Budget to edit; omit for create mode. */
  budget?: Models.Budget | null
  /** Options for the api_key and account scopes. */
  scopeOptions: ScopeOptions
}

/** Create/edit dialog for one budget, keyed so every open starts fresh. */
export default function BudgetFormDialog({ budget, ...props }: BudgetFormDialogProps) {
  return budget?.id ? (
    <EditBudgetForm key={`${budget.id}-${props.open}`} budget={budget} {...props} />
  ) : (
    <AddBudgetForm key={`new-${props.open}`} {...props} />
  )
}

function AddBudgetForm(props: Omit<BudgetFormDialogProps, 'budget'>) {
  const mutation = useMutation(queries.budgets.create())
  return <AbstractForm {...props} defaultValues={valuesFrom()} mutation={mutation} />
}

function EditBudgetForm({
  budget,
  ...props
}: Omit<BudgetFormDialogProps, 'budget'> & { budget: Models.Budget }) {
  const mutation = useMutation(queries.budgets.update(budget.id))
  return <AbstractForm {...props} defaultValues={valuesFrom(budget)} mutation={mutation} isEdit />
}
