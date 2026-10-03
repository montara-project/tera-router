import { IconChevronDown, IconChevronUp, IconPlus, IconStack2, IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import DialogContent, {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { ChainStepSchema } from '@/lib/api/dtos/chain/schema'
import { queries } from '@/lib/api/queries'
import { CHAIN_STRATEGY_OPTIONS } from '@/lib/constants/chain'
import { requiredString } from '@/lib/validation'

const ChainFormSchema = z.object({
  name: requiredString('name'),
  strategy: requiredString('strategy'),
  enabled: z.boolean(),
  context_window: z.string(),
  fallback_provider: z.string(),
  fallback_model: z.string(),
  steps: z.array(ChainStepSchema),
})

/** Model combobox page size — the server caps the catalog page at 100. */
const MODEL_OPTIONS_LIMIT = 100

/** The blue info tone the chains page uses for chain identity. */
const CHAIN_BADGE_CLASS =
  'bg-blue-50 text-blue-600 ring-1 ring-blue-200/70 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/60'

interface ChainFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chain to edit; omit (or pass null) for create mode. */
  chain?: Models.Chain | null
}

/**
 * Create/edit dialog for one chain. The inner form is keyed by chain id so
 * every open starts from fresh defaults instead of the previous session's
 * values.
 */
export default function ChainFormDialog({ open, onOpenChange, chain }: ChainFormDialogProps) {
  const editing = Boolean(chain?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="border-border border-b px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <IconBadge icon={IconStack2} className={CHAIN_BADGE_CLASS} iconClassName="size-5" />
            <div className="min-w-0">
              <DialogTitle className="text-base">
                {editing ? 'Edit Chain' : 'Create Chain'}
              </DialogTitle>
              <DialogDescription>
                Ordered provider/model steps the router walks through when the primary target cannot
                serve a request.
              </DialogDescription>
            </div>
          </div>
        </div>

        <DialogBody className="px-6 py-5">
          <ChainForm key={chain?.id ?? 'new'} chain={chain} onOpenChange={onOpenChange} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

interface ChainFormProps {
  chain?: Models.Chain | null
  onOpenChange: (open: boolean) => void
}

function ChainForm({ chain, onOpenChange }: ChainFormProps) {
  const editing = Boolean(chain?.id)

  const createMutation = useMutation(queries.chains.create())
  const updateMutation = useMutation(queries.chains.update(chain?.id ?? ''))

  const form = useAppForm({
    defaultValues: {
      name: chain?.name ?? '',
      strategy: chain?.strategy || 'priority',
      enabled: chain?.enabled ?? true,
      context_window: chain?.context_window ? String(chain.context_window) : '',
      fallback_provider: chain?.fallback_provider ?? '',
      fallback_model: chain?.fallback_model ?? '',
      steps:
        chain?.steps && chain.steps.length > 0
          ? chain.steps.map((step) => ({ provider: step.provider, model: step.model }))
          : [{ provider: '', model: '' }],
    },
    validators: {
      onSubmit: ChainFormSchema,
    },
    onSubmit: async ({ value }) => {
      const steps = value.steps
        .filter((step) => step.provider.trim() !== '' && step.model.trim() !== '')
        .map((step) => ({ provider: step.provider.trim(), model: step.model.trim() }))
      if (steps.length === 0) {
        toast.error('Add at least one complete provider/model step')
        return
      }

      const payload = {
        name: value.name.trim(),
        strategy: value.strategy,
        enabled: value.enabled,
        context_window: Number(value.context_window) || undefined,
        fallback_provider: value.fallback_provider.trim() || undefined,
        fallback_model: value.fallback_model.trim() || undefined,
        steps,
      }

      try {
        if (editing) {
          await updateMutation.mutateAsync(payload)
          toast.success('Chain updated')
        } else {
          await createMutation.mutateAsync(payload)
          toast.success('Chain created')
        }
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const saving = createMutation.isPending || updateMutation.isPending
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)

  // Provider combobox lists connected providers only — a chain step has to be
  // able to serve traffic. Model comboboxes read the selected provider's
  // stored catalog (limit = server page cap), active models only.
  const providersQuery = useQuery(queries.providers.list())
  const connectedProviders = providersQuery.data?.data?.connected ?? []
  const providerOptions: Option<string>[] = connectedProviders.map((p) => ({
    value: p.slug,
    label: p.name || p.slug,
  }))

  // One catalog query per distinct provider used across steps + terminal
  // fallback; rows share the fetched options via a slug → options map.
  const usedProviderKey = useSelector(form.store, (s) =>
    [
      ...new Set(
        [
          ...s.values.steps.map((step) => step.provider.trim()),
          s.values.fallback_provider.trim(),
        ].filter(Boolean)
      ),
    ].join('\u0000')
  )
  const usedProviders = usedProviderKey ? usedProviderKey.split('\u0000') : []
  const fallbackProvider = useSelector(form.store, (s) => s.values.fallback_provider.trim())

  const modelQueries = useQueries({
    queries: usedProviders.map((slug) => {
      const provider = connectedProviders.find((p) => p.slug === slug)
      // Catalog providers carry "prov-<slug>" ids; custom providers carry uuids.
      const isCatalog = provider?.id.startsWith('prov-') ?? true
      return isCatalog
        ? queries.providers.catalogModels(provider?.slug ?? slug, {
            limit: MODEL_OPTIONS_LIMIT,
            // Filter server-side so the one fetched page holds the enabled
            // models even when the full catalog spans many pages.
            state: 'active',
          })
        : queries.providers.customModels(provider?.id ?? '', {
            limit: MODEL_OPTIONS_LIMIT,
            state: 'active',
          })
    }),
  })
  const modelOptionsBySlug = new Map<string, Option<string>[]>()
  usedProviders.forEach((slug, i) => {
    // Keep the client filter as a guard for servers predating the state param.
    const models = (modelQueries[i]?.data?.data?.models ?? []).filter(
      (model) => model.state === 'active'
    )
    modelOptionsBySlug.set(
      slug,
      models.map((model) => ({ value: model.id, label: model.id }))
    )
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="space-y-5">
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" asterisk placeholder="fast-fallback" />}
        </form.AppField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="strategy">
            {(field) => <field.SelectField label="Strategy" options={CHAIN_STRATEGY_OPTIONS} />}
          </form.AppField>

          <form.AppField name="context_window">
            {(field) => (
              <field.NumberField
                label="Context window"
                placeholder="e.g. 128000"
                decimalScale={0}
              />
            )}
          </form.AppField>
        </div>

        <form.AppField name="enabled">
          {(field) => (
            <div className="border-border flex items-center justify-between gap-4 rounded-lg border px-3.5 py-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-muted-foreground text-xs">
                  Serve this chain to routing clients.
                </p>
              </div>
              <Switch
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
                onBlur={field.handleBlur}
                aria-label="Enable this chain"
              />
            </div>
          )}
        </form.AppField>

        <form.AppField name="steps" mode="array">
          {(field) => {
            const rows = field.state.value
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Steps
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {rows.length === 0
                      ? 'first healthy target serves'
                      : `walked in order · ${rows.length} step${rows.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                {rows.map((row, i) => (
                  <div
                    key={`step-${i}`}
                    className="border-border hover:bg-muted/30 group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-semibold tabular-nums text-blue-600 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
                      {i + 1}
                    </span>
                    <form.AppField name={`steps[${i}].provider`}>
                      {(subField) => (
                        <div className="min-w-0 flex-1">
                          <subField.ComboboxField
                            label="Provider"
                            hideLabel
                            placeholder="provider"
                            options={providerOptions}
                            defaultValues={row.provider ? [row.provider] : []}
                            onSelect={() => {
                              // Model ids are provider-specific; start clean on switch.
                              form.setFieldValue(`steps[${i}].model`, '')
                            }}
                          />
                        </div>
                      )}
                    </form.AppField>
                    <span className="text-muted-foreground/60">/</span>
                    <form.AppField name={`steps[${i}].model`}>
                      {(subField) => (
                        <div className="min-w-0 flex-[1.4]">
                          <subField.ComboboxField
                            label="Model"
                            hideLabel
                            placeholder={row.provider.trim() ? 'model' : 'pick a provider first'}
                            options={modelOptionsBySlug.get(row.provider.trim()) ?? []}
                            defaultValues={row.model ? [row.model] : []}
                            disabled={row.provider.trim() === ''}
                          />
                        </div>
                      )}
                    </form.AppField>
                    <span className="ml-auto flex shrink-0 items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        className="size-7"
                        aria-label={`Move step ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => field.moveValue(i, i - 1)}
                      >
                        <IconChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        className="size-7"
                        aria-label={`Move step ${i + 1} down`}
                        disabled={i === rows.length - 1}
                        onClick={() => field.moveValue(i, i + 1)}
                      >
                        <IconChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        className="hover:text-destructive size-7"
                        aria-label={`Remove step ${i + 1}`}
                        onClick={() => field.removeValue(i)}
                      >
                        <IconX className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                ))}

                {rows.some((row) => (row.provider.trim() === '') !== (row.model.trim() === '')) ? (
                  <p className="text-xs text-destructive">
                    Every step needs both a provider and a model before saving.
                  </p>
                ) : null}

                {rows.length === 0 ? (
                  <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
                    No steps yet — add the first provider/model this chain should try.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-dashed"
                  onClick={() => form.pushFieldValue('steps', { provider: '', model: '' })}
                >
                  <IconPlus /> Add step
                </Button>
              </div>
            )
          }}
        </form.AppField>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Terminal fallback <span className="normal-case">(optional)</span>
            </p>
            <span className="text-muted-foreground text-xs">serves only when every step fails</span>
          </div>
          <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
            <form.AppField name="fallback_provider">
              {(field) => (
                <div className="min-w-0 flex-1">
                  <field.ComboboxField
                    label="Provider"
                    hideLabel
                    placeholder="provider"
                    options={providerOptions}
                    defaultValues={field.state.value ? [field.state.value] : []}
                    onSelect={() => {
                      // Model ids are provider-specific; start clean on switch.
                      form.setFieldValue('fallback_model', '')
                    }}
                  />
                </div>
              )}
            </form.AppField>
            <span className="text-muted-foreground/60">/</span>
            <form.AppField name="fallback_model">
              {(field) => (
                <div className="min-w-0 flex-[1.4]">
                  <field.ComboboxField
                    label="Model"
                    hideLabel
                    placeholder={fallbackProvider ? 'model' : 'pick a provider first'}
                    options={modelOptionsBySlug.get(fallbackProvider) ?? []}
                    defaultValues={field.state.value ? [field.state.value] : []}
                    disabled={!fallbackProvider}
                  />
                </div>
              )}
            </form.AppField>
          </div>
        </div>

        <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Steps run top to bottom — later steps only serve when earlier ones fail.
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || saving}>
              {isSubmitting || saving ? 'Saving…' : editing ? 'Save changes' : 'Create chain'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
