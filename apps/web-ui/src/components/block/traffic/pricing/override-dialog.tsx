import { useSelector } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** USD per million tokens; the wire format is micros of that. */
const MICROS_PER_DOLLAR = 1_000_000

/** Model combobox page size — the server caps the catalog page at 100. */
const MODEL_OPTIONS_LIMIT = 100

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
      token_consumption_rate: override?.token_consumption_rate
        ? String(override.token_consumption_rate)
        : '',
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
    ...queries.providers.catalogModels(selectedProviderModel?.slug ?? '', {
      limit: MODEL_OPTIONS_LIMIT,
    }),
    enabled: !!selectedProviderModel && isCatalogProvider,
  })
  const customModelsQuery = useQuery({
    ...queries.providers.customModels(selectedProviderModel?.id ?? '', {
      limit: MODEL_OPTIONS_LIMIT,
    }),
    enabled: !!selectedProviderModel && !isCatalogProvider,
  })

  const modelOptions: Option<string>[] = (
    (isCatalogProvider
      ? catalogModelsQuery.data?.data?.models
      : customModelsQuery.data?.data?.models) ?? []
  ).map((model) => ({ value: model.id, label: model.id }))

  const saving = useSelector(form.store, (s) => s.isSubmitting)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{override ? 'Edit pricing override' : 'Add pricing override'}</DialogTitle>
          <DialogDescription>
            Per-model rates in USD per million tokens. An override beats the built-in catalog and
            takes effect on the next request — no restart.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            <DialogBody className="space-y-4">
              <form.AppField name="provider">
                {(field) => (
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
              </form.AppField>

              <form.AppField name="scope">
                {(field) => (
                  <field.SelectField
                    label="Scope"
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
              </form.AppField>

              <form.Subscribe selector={(s) => s.values.scope}>
                {(scope) =>
                  scope === 'model' ? (
                    <form.AppField name="model">
                      {(field) => (
                        <field.ComboboxField
                          label="Model"
                          placeholder={
                            selectedProviderModel
                              ? 'Select a model...'
                              : 'Select a provider first...'
                          }
                          options={modelOptions}
                          defaultValues={override?.model ? [override.model] : []}
                          disabled={!selectedProviderModel}
                          asterisk
                        />
                      )}
                    </form.AppField>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Blanket rate for every model on this provider without a more specific
                      override.
                    </p>
                  )
                }
              </form.Subscribe>

              <div className="grid grid-cols-2 gap-3">
                <form.AppField name="input_micros">
                  {(field) => (
                    <field.TextField label="Input $/M" placeholder="0 = free" inputMode="decimal" />
                  )}
                </form.AppField>
                <form.AppField name="output_micros">
                  {(field) => (
                    <field.TextField
                      label="Output $/M"
                      placeholder="0 = free"
                      inputMode="decimal"
                    />
                  )}
                </form.AppField>
              </div>

              <details className="rounded-lg border border-border px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Advanced rates (cache and reasoning)
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <form.AppField name="cache_read_micros">
                    {(field) => <field.TextField label="Cache read $/M" inputMode="decimal" />}
                  </form.AppField>
                  <form.AppField name="cache_write_micros">
                    {(field) => <field.TextField label="Cache write $/M" inputMode="decimal" />}
                  </form.AppField>
                  <form.AppField name="reasoning_micros">
                    {(field) => (
                      <field.TextField
                        label="Reasoning $/M"
                        placeholder="0 = bill at output rate"
                        inputMode="decimal"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="token_consumption_rate">
                    {(field) => (
                      <field.TextField
                        label="Token consumption rate"
                        placeholder="1 = 1:1 budget drain"
                        inputMode="decimal"
                      />
                    )}
                  </form.AppField>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Token consumption rate scales budget drain only — cost accounting always uses real
                  tokens. A rate of 0 makes the model drain no token budget.
                </p>
              </details>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {override ? 'Save changes' : 'Add override'}
              </Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
