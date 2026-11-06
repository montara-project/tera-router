import { IconChevronDown } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import ComboboxInput from '@/components/block/common/combobox-input'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { KeyFormSchema, type KeyFormValues } from '@/lib/api/dtos/key/schema'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

const NO_PLAN = 'none'

const DEFAULT_VALUES: KeyFormValues = {
  name: '',
  plan_id: NO_PLAN,
  limit_usd: '',
  limit_tokens: '',
  period: 'monthly',
  models: [],
  alert_pct: '80',
  hard_cutoff: true,
}

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Label row with a muted hint on the right, as in the other forms. */
export function FieldLabel({
  htmlFor,
  label,
  hint,
}: {
  htmlFor: string
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium">
        {label}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

type AddKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the stored key (with full_key) to show the one-time secret dialog. */
  onCreated?: (key: Models.ApiKey) => void
}

/** Keyed by open state so every open starts from an empty form. */
export function AddKeyForm(props: AddKeyFormProps) {
  return <CreateKeyForm key={String(props.open)} {...props} />
}

const optionalNumber = (raw: string) => (raw.trim() === '' ? undefined : Number(raw))

function CreateKeyForm({ open, onOpenChange, onCreated }: AddKeyFormProps) {
  const id = useId()
  const [advanced, setAdvanced] = useState(false)

  const plansQuery = useQuery(queries.plans.list())
  const plans = plansQuery.data?.data ?? []

  const createKey = useMutation(queries.keys.create())
  const createBudget = useMutation(queries.budgets.create())

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: {
      onSubmit: KeyFormSchema,
      onChange: KeyFormSchema,
    },
    onSubmit: async ({ value }) => {
      const usd = optionalNumber(value.limit_usd)
      const tokens = optionalNumber(value.limit_tokens)

      let key: Models.ApiKey
      try {
        const res = await createKey.mutateAsync({
          name: value.name.trim(),
          plan_id: value.plan_id === NO_PLAN ? undefined : value.plan_id,
          allowed_models: value.models.length ? value.models : undefined,
        })
        key = res.data
      } catch (error) {
        toastAxiosError(error)
        return
      }

      // The key exists from here on; a budget failure is reported, not hidden,
      // and the secret is still shown because it is the only chance to copy it.
      if (usd !== undefined || tokens !== undefined) {
        try {
          await createBudget.mutateAsync({
            scope_kind: 'api_key',
            scope_id: key.id,
            budget_spend: usd,
            limit_tokens: tokens,
            period: value.period,
            alert_pct: Number(value.alert_pct),
            hard_cutoff: value.hard_cutoff,
          })
        } catch (error) {
          toastAxiosError(error)
          toast.error('Key created without its limit. Add the budget under Plans & budgets.')
        }
      }

      onOpenChange(false)
      onCreated?.(key)
    },
  })

  const planId = useSelector(form.store, (state) => state.values.plan_id)
  const hasLimit = useSelector(
    form.store,
    (state) => state.values.limit_usd.trim() !== '' || state.values.limit_tokens.trim() !== ''
  )
  const plan = plans.find((p) => p.id === planId)

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title="Create API key"
      description="The key is shown once after it is created."
      confirmText="Create key"
      loading={createKey.isPending || createBudget.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField
            label="Name"
            placeholder="e.g. Cursor on my laptop"
            autoComplete="off"
            asterisk
          />
        )}
      />

      <div className="space-y-1.5">
        <form.AppField
          name="plan_id"
          children={(field) => (
            <field.SelectField
              label="Plan"
              className="w-full"
              options={[
                { value: NO_PLAN, label: 'No plan' },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          {plan
            ? plan.description || `Limits and models follow ${plan.name}.`
            : 'No plan. Set limits under Advanced.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <button
          type="button"
          aria-expanded={advanced}
          aria-controls={`${id}-advanced`}
          onClick={() => setAdvanced((v) => !v)}
          className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium hover:bg-muted/40"
        >
          Advanced · limits and models
          <IconChevronDown
            className={cn('size-4 text-muted-foreground', advanced && 'rotate-180')}
            aria-hidden
          />
        </button>
        {advanced ? (
          <div id={`${id}-advanced`} className="space-y-4 border-t border-border p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <form.AppField
                name="limit_usd"
                children={(field) => (
                  <field.NumberField label="Limit (USD)" currency placeholder="50.00" />
                )}
              />
              <form.AppField
                name="limit_tokens"
                children={(field) => (
                  <field.NumberField label="Limit (tokens)" placeholder="100,000,000" />
                )}
              />
              <form.AppField
                name="period"
                children={(field) => (
                  <field.SelectField label="Period" className="w-full" options={PERIOD_OPTIONS} />
                )}
              />
            </div>

            <p className="-mt-2 text-xs text-muted-foreground">
              Limits are optional; empty means no limit.
            </p>

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
                    Empty allows every model. * matches many, e.g. claude-*.
                  </p>
                </div>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <form.AppField
                name="alert_pct"
                children={(field) => (
                  <field.NumberField label="Alert at (%)" max={100} disabled={!hasLimit} />
                )}
              />
              <form.AppField
                name="hard_cutoff"
                children={(field) => (
                  <div
                    className={cn(
                      'flex items-center justify-between gap-4 self-start rounded-md border border-border sm:mt-7 px-3 py-2.5 sm:col-span-2',
                      !hasLimit && 'opacity-60'
                    )}
                  >
                    <label htmlFor={`${id}-cutoff`} className="text-[13px] font-medium">
                      Block requests when the budget is used up
                    </label>
                    <Switch
                      id={`${id}-cutoff`}
                      checked={field.state.value}
                      disabled={!hasLimit}
                      onCheckedChange={field.handleChange}
                    />
                  </div>
                )}
              />
            </div>
            {!hasLimit ? (
              <p className="text-xs text-muted-foreground">
                Alert and block apply once a USD or token limit is set.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** Multi-select of model ids with free-form patterns such as claude-*. */
export function ModelPatternPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const modelsQuery = useQuery(queries.playground.models())
  const options = (modelsQuery.data?.data ?? []).map((m) => ({ value: m.id, label: m.id }))

  return (
    <ComboboxInput
      id={id}
      label="Models"
      placeholder="Search and select models..."
      options={options}
      defaultValues={value}
      selection={value}
      onSelect={onChange}
      multiple
      creatable
    />
  )
}
