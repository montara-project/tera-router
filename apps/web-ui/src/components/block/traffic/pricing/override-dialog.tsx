import { IconChevronDown } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** USD per million tokens; the wire format is micros of that. */
const MICROS_PER_DOLLAR = 1_000_000

const OverrideDialogSchema = z.object({
  provider: z.string().min(1, 'The provider field is required.'),
  model: z.string(),
  scope: z.enum(['all', 'model']),
  input_micros: z
    .string()
    .refine((v) => v !== '' && Number(v) >= 0, 'Input rate must be zero or greater.'),
  output_micros: z
    .string()
    .refine((v) => v !== '' && Number(v) >= 0, 'Output rate must be zero or greater.'),
  cache_read_micros: z
    .string()
    .refine((v) => v === '' || Number(v) >= 0, 'Cache read rate cannot be negative.'),
  cache_write_micros: z
    .string()
    .refine((v) => v === '' || Number(v) >= 0, 'Cache write rate cannot be negative.'),
  reasoning_micros: z
    .string()
    .refine((v) => v === '' || Number(v) >= 0, 'Reasoning rate cannot be negative.'),
  token_consumption_rate: z
    .string()
    .refine((v) => v === '' || Number(v) >= 0, 'Token consumption rate cannot be negative.'),
})

const usdToMicros = (usd: string) => Math.round(Number(usd) * MICROS_PER_DOLLAR)
const microsToUsd = (micros: number) => String(micros / MICROS_PER_DOLLAR)

interface OverrideDialogProps {
  open: boolean
  onClose: () => void
  /** Existing override to edit, or null to create one. */
  override?: Models.PricingOverride | null
  /** Connected + available providers for the picker. */
  providers: Models.Provider[]
}

export default function OverrideDialog({
  open,
  onClose,
  override = null,
  providers,
}: OverrideDialogProps) {
  const id = useId()
  // Open from the start when the override being edited already sets an advanced rate.
  const [advanced, setAdvanced] = useState(
    () =>
      !!override &&
      (override.cache_read_micros > 0 ||
        override.cache_write_micros > 0 ||
        override.reasoning_micros > 0 ||
        override.token_consumption_rate != null)
  )
  const upsertMutation = useMutation(queries.overrides.pricingUpsert())

  const form = useAppForm({
    defaultValues: {
      provider: override?.provider ?? '',
      model: override?.model ?? '',
      scope: override ? (override.model === '' ? 'all' : 'model') : 'all',
      input_micros: override ? microsToUsd(override.input_micros) : '',
      output_micros: override ? microsToUsd(override.output_micros) : '',
      cache_read_micros: override ? microsToUsd(override.cache_read_micros) : '',
      cache_write_micros: override ? microsToUsd(override.cache_write_micros) : '',
      reasoning_micros: override ? microsToUsd(override.reasoning_micros) : '',
      token_consumption_rate:
        override?.token_consumption_rate != null ? String(override.token_consumption_rate) : '',
    },
    validators: {
      onSubmit: OverrideDialogSchema,
      onChange: OverrideDialogSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await upsertMutation.mutateAsync({
          provider: value.provider.trim(),
          model: value.scope === 'all' ? '' : value.model.trim(),
          input_micros: usdToMicros(value.input_micros),
          output_micros: usdToMicros(value.output_micros),
          cache_read_micros: usdToMicros(value.cache_read_micros || '0'),
          cache_write_micros: usdToMicros(value.cache_write_micros || '0'),
          reasoning_micros: usdToMicros(value.reasoning_micros || '0'),
          token_consumption_rate: value.token_consumption_rate
            ? Number(value.token_consumption_rate)
            : undefined,
        })
        toast.success(override ? 'Pricing override saved' : 'Pricing override created')
        onClose()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const providerOptions: Option<string>[] = providers.map((p) => ({
    value: p.slug,
    label: p.name || p.slug,
  }))

  const selectedProviderSlug = useSelector(form.store, (s) => s.values.provider)
  const selectedProviderModel = providers.find((p) => p.slug === selectedProviderSlug)
  // Catalog providers carry "prov-<slug>" ids; custom providers carry uuids.
  const isCatalogProvider = selectedProviderModel?.id.startsWith('prov-') ?? true

  const catalogModelsQuery = useQuery({
    // Disabled models are not routable: the server keeps the active ones,
    // and every page of them is read so a large catalog is offered whole.
    ...queries.providers.allActiveModels('catalog', selectedProviderModel?.slug ?? ''),
    enabled: !!selectedProviderModel && isCatalogProvider,
  })
  const customModelsQuery = useQuery({
    ...queries.providers.allActiveModels('custom', selectedProviderModel?.id ?? ''),
    enabled: !!selectedProviderModel && !isCatalogProvider,
  })

  const modelOptions: Option<string>[] = (
    (isCatalogProvider
      ? catalogModelsQuery.data?.data?.models
      : customModelsQuery.data?.data?.models) ?? []
  ).map((model) => ({ value: model.id, label: model.id }))

  const saving = useSelector(form.store, (s) => s.isSubmitting)
  // form.Subscribe in this form version always hands children the full
  // FormState, so read the scope through the store instead.
  const scope = useSelector(form.store, (s) => s.values.scope)

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={override ? 'Edit pricing override' : 'Add pricing override'}
      description="Rates in USD per million tokens. An override beats the built-in catalog and applies on the next request."
      confirmText={override ? 'Save changes' : 'Add override'}
      loading={saving}
      size="md"
    >
      <form.AppField
        name="provider"
        children={(field) => (
          <field.ComboboxField
            label="Provider"
            placeholder="Select a provider..."
            options={providerOptions}
            defaultValues={override ? [override.provider] : []}
            disabled={!!override}
            asterisk
            onSelect={() => {
              // Model ids are provider-specific; start clean on switch.
              form.setFieldValue('model', '')
            }}
          />
        )}
      />

      <div className="space-y-1.5">
        <form.AppField
          name="scope"
          children={(field) => (
            <field.SelectField
              label="Scope"
              className="w-full"
              options={[
                { value: 'all', label: 'All models on this provider' },
                { value: 'model', label: 'A specific model' },
              ]}
              disabled={!!override && override.model !== ''}
              onSelect={() => {
                // Model text survives scope flips so an accidental
                // toggle does not wipe the typed id.
                if (field.state.value === 'all') form.setFieldValue('model', '')
              }}
            />
          )}
        />
        {scope === 'all' ? (
          <p className="text-xs text-muted-foreground">
            Blanket rate for every model on this provider without a more specific override.
          </p>
        ) : null}
      </div>

      {scope === 'model' ? (
        <form.AppField
          name="model"
          children={(field) => (
            <field.ComboboxField
              label="Model"
              placeholder={
                selectedProviderModel ? 'Select a model...' : 'Select a provider first...'
              }
              options={modelOptions}
              defaultValues={override?.model ? [override.model] : []}
              disabled={!selectedProviderModel}
              asterisk
            />
          )}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <form.AppField
          name="input_micros"
          children={(field) => (
            <field.NumberField
              label="Input $/M"
              placeholder="0 = free"
              currency
              decimalScale={6}
              asterisk
            />
          )}
        />
        <form.AppField
          name="output_micros"
          children={(field) => (
            <field.NumberField
              label="Output $/M"
              placeholder="0 = free"
              currency
              decimalScale={6}
              asterisk
            />
          )}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <button
          type="button"
          aria-expanded={advanced}
          aria-controls={`${id}-advanced`}
          onClick={() => setAdvanced((v) => !v)}
          className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium hover:bg-muted/40"
        >
          Advanced · cache and reasoning rates
          <IconChevronDown
            className={cn('size-4 text-muted-foreground', advanced && 'rotate-180')}
            aria-hidden
          />
        </button>
        {advanced ? (
          <div id={`${id}-advanced`} className="space-y-4 border-t border-border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <form.AppField
                name="cache_read_micros"
                children={(field) => (
                  <field.NumberField
                    label="Cache read $/M"
                    placeholder="0"
                    currency
                    decimalScale={6}
                  />
                )}
              />
              <form.AppField
                name="cache_write_micros"
                children={(field) => (
                  <field.NumberField
                    label="Cache write $/M"
                    placeholder="0"
                    currency
                    decimalScale={6}
                  />
                )}
              />
              <form.AppField
                name="reasoning_micros"
                children={(field) => (
                  <field.NumberField
                    label="Reasoning $/M"
                    placeholder="0 = bill at output rate"
                    currency
                    decimalScale={6}
                  />
                )}
              />
              <form.AppField
                name="token_consumption_rate"
                children={(field) => (
                  <field.NumberField
                    label="Token consumption rate"
                    placeholder="1 = 1:1 budget drain"
                    decimalScale={4}
                  />
                )}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Empty rates count as 0. Token consumption rate scales budget drain only; cost
              accounting always uses real tokens, and 0 drains no token budget.
            </p>
          </div>
        ) : null}
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
