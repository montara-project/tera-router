import { IconChevronDown, IconChevronUp, IconPlus, IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AliasTargetSchema } from '@/lib/api/dtos/alias/schema'
import { queries } from '@/lib/api/queries'
import { requiredString } from '@/lib/validation'

/** Model combobox page size — the server caps the catalog page at 100. */
const MODEL_OPTIONS_LIMIT = 100

export const CONTEXT_WINDOW_OPTIONS = [
  { value: 0, label: 'Default (unlimited)' },
  { value: 8192, label: '8K tokens' },
  { value: 16384, label: '16K tokens' },
  { value: 32768, label: '32K tokens' },
  { value: 65536, label: '64K tokens' },
  { value: 131072, label: '128K tokens' },
  { value: 200000, label: '200K tokens' },
  { value: 1000000, label: '1M tokens' },
]

export function contextWindowLabel(value: number) {
  return (
    CONTEXT_WINDOW_OPTIONS.find((o) => o.value === value)?.label ??
    `${value.toLocaleString()} tokens`
  )
}

const AliasFormSchema = z.object({
  name: requiredString('name'),
  group: z.string(),
  context_window: requiredString('context window'),
  active: z.boolean(),
  targets: z.array(AliasTargetSchema.extend({ active: z.boolean() })),
})

const isPartialTarget = (t: { provider: string; model: string }) =>
  (t.provider.trim() === '') !== (t.model.trim() === '')

interface AliasFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Alias to edit; omit (or pass null) for create mode. */
  alias?: Models.ModelAlias | null
}

/**
 * Create/edit dialog for one alias pool. The form is keyed by alias id + open
 * state so every open starts from fresh defaults instead of the previous
 * session's values.
 */
export default function AliasFormDialog({ open, onOpenChange, alias }: AliasFormDialogProps) {
  return (
    <AliasForm
      key={`${alias?.id ?? 'new'}-${open}`}
      open={open}
      alias={alias}
      onOpenChange={onOpenChange}
    />
  )
}

interface AliasFormProps {
  open: boolean
  alias?: Models.ModelAlias | null
  onOpenChange: (open: boolean) => void
}

function AliasForm({ open, alias, onOpenChange }: AliasFormProps) {
  const editing = Boolean(alias?.id)
  const submitLabel = editing ? 'Save changes' : 'Create alias'

  const upsertMutation = useMutation(queries.aliases.upsert())
  // Existing groups feed the Group input's suggestions; any new name is fine.
  const aliasesQuery = useQuery(queries.aliases.list())
  const groups = [
    ...new Set((aliasesQuery.data?.data ?? []).map((a) => a.group?.trim() ?? '').filter(Boolean)),
  ].sort()

  const form = useAppForm({
    defaultValues: {
      name: alias?.name ?? '',
      group: alias?.group ?? '',
      context_window: String(alias?.context_window ?? 0),
      active: alias?.active ?? true,
      targets:
        alias?.targets && alias.targets.length > 0
          ? alias.targets.map((t) => ({ provider: t.provider, model: t.model, active: t.active }))
          : [{ provider: '', model: '', active: true }],
    },
    validators: {
      onSubmit: AliasFormSchema,
    },
    onSubmit: async ({ value }) => {
      const targets = value.targets
        .filter((t) => t.provider.trim() !== '' && t.model.trim() !== '')
        .map((t) => ({ provider: t.provider.trim(), model: t.model.trim(), active: t.active }))
      if (targets.length === 0) {
        toast.error('Add at least one complete provider/model target')
        return
      }

      try {
        // PUT replaces name, targets, and active together server-side.
        await upsertMutation.mutateAsync({
          name: value.name.trim(),
          group: value.group.trim(),
          // Renames the stored pool when the name changed.
          previous_name: alias?.name,
          context_window: Number(value.context_window) || undefined,
          active: value.active,
          targets,
        })
        toast.success(editing ? 'Alias updated' : 'Alias created')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const saving = isSubmitting || upsertMutation.isPending
  const activeTargetCount = useSelector(
    form.store,
    (s) => s.values.targets.filter((t) => t.active && t.provider.trim() !== '').length
  )
  const hasIncompleteTarget = useSelector(form.store, (s) => s.values.targets.some(isPartialTarget))

  // Provider combobox lists usable providers only — a target has to be able
  // to serve traffic. Model comboboxes read the selected provider's stored
  // catalog (limit = server page cap).
  const providersQuery = useQuery(queries.providers.list())
  const providers = (providersQuery.data?.data?.connected ?? []).filter((p) => p.usable)
  const providerOptions: Option<string>[] = providers.map((p) => ({
    value: p.slug,
    label: p.name || p.slug,
  }))

  // One catalog query per distinct provider used across targets; rows share
  // the fetched options via a slug → options map.
  const usedProviderKey = useSelector(form.store, (s) =>
    [...new Set(s.values.targets.map((t) => t.provider.trim()).filter(Boolean))].join('\u0000')
  )
  const usedProviders = usedProviderKey ? usedProviderKey.split('\u0000') : []

  const modelQueries = useQueries({
    queries: usedProviders.map((slug) => {
      const provider = providers.find((p) => p.slug === slug)
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
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit Alias' : 'Create Alias'}
      description="One alias name mapped to an ordered pool of provider/model targets."
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      confirmText={submitLabel}
      loading={saving}
      disabled={hasIncompleteTarget}
    >
      <div className="space-y-5">
        <form.AppField name="name">
          {(field) => (
            <div className="space-y-1.5">
              <field.TextField label="Name" asterisk placeholder="alias-name" />
              {editing && field.state.value.trim() !== alias?.name ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Clients, keys, and plans still using “{alias?.name}” will stop resolving.
                </p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <form.AppField name="group">
          {(field) => (
            <div className="space-y-1.5">
              <field.TextField label="Group" placeholder="coding" list="alias-group-options" />
              <datalist id="alias-group-options">
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </datalist>
              <p className="text-muted-foreground text-xs">
                Groups only organise the alias list; leave empty for Ungrouped.
              </p>
            </div>
          )}
        </form.AppField>

        <form.AppField name="context_window">
          {(field) => (
            <field.SelectField
              label="Context window"
              options={CONTEXT_WINDOW_OPTIONS.map((o) => ({
                value: String(o.value),
                label: o.label,
              }))}
            />
          )}
        </form.AppField>

        <form.AppField name="active">
          {(field) => (
            <div className="border-border flex items-center justify-between gap-4 rounded-lg border px-3.5 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-muted-foreground text-xs">
                  Resolve this alias for routing clients.
                </p>
              </div>
              <Switch
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
                onBlur={field.handleBlur}
                aria-label="Activate this alias"
              />
            </div>
          )}
        </form.AppField>

        <form.AppField name="targets" mode="array">
          {(field) => {
            const rows = field.state.value
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Fallback order
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {activeTargetCount} of {rows.length} active
                  </span>
                </div>

                {rows.map((row, i) => (
                  // The array field re-renders only when rows are added or
                  // removed, so the row's active flag comes from a subscription.
                  <form.Subscribe
                    key={`target-${i}`}
                    selector={(s) => s.values.targets[i]?.active ?? true}
                  >
                    {(active) => (
                      <div
                        className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/30 ${
                          active ? 'border-border' : 'border-dashed border-border/60 opacity-70'
                        }`}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-xs font-semibold tabular-nums text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50">
                          {i + 1}
                        </span>
                        <form.AppField name={`targets[${i}].provider`}>
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
                                  form.setFieldValue(`targets[${i}].model`, '')
                                }}
                              />
                            </div>
                          )}
                        </form.AppField>
                        <span className="text-muted-foreground/60">/</span>
                        {/* `row` goes stale between add/remove; subscribe to the provider. */}
                        <form.Subscribe
                          selector={(s) => s.values.targets[i]?.provider.trim() ?? ''}
                        >
                          {(provider) => (
                            <form.AppField name={`targets[${i}].model`}>
                              {(subField) => (
                                <div className="min-w-0 flex-[1.4]">
                                  <subField.ComboboxField
                                    label="Model"
                                    hideLabel
                                    placeholder={provider ? 'model' : 'pick a provider first'}
                                    options={modelOptionsBySlug.get(provider) ?? []}
                                    defaultValues={row.model ? [row.model] : []}
                                    disabled={provider === ''}
                                  />
                                </div>
                              )}
                            </form.AppField>
                          )}
                        </form.Subscribe>
                        <span className="ml-auto flex shrink-0 items-center gap-0.5">
                          <form.AppField name={`targets[${i}].active`}>
                            {(subField) => (
                              <Switch
                                size="sm"
                                className="mr-1"
                                checked={subField.state.value}
                                onCheckedChange={subField.handleChange}
                                aria-label={`Target ${i + 1} active`}
                              />
                            )}
                          </form.AppField>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            className="size-7"
                            aria-label={`Move target ${i + 1} up`}
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
                            aria-label={`Move target ${i + 1} down`}
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
                            aria-label={`Remove target ${i + 1}`}
                            onClick={() => field.removeValue(i)}
                          >
                            <IconX className="size-3.5" />
                          </Button>
                        </span>
                      </div>
                    )}
                  </form.Subscribe>
                ))}

                {hasIncompleteTarget ? (
                  <p className="text-xs text-destructive">
                    Every target needs both a provider and a model before saving.
                  </p>
                ) : null}

                {rows.length === 0 ? (
                  <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
                    No targets yet — add the first provider/model this alias should try.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-dashed"
                  onClick={() =>
                    form.pushFieldValue('targets', { provider: '', model: '', active: true })
                  }
                >
                  <IconPlus /> Add target
                </Button>
              </div>
            )
          }}
        </form.AppField>

        <p className="text-muted-foreground text-xs">
          Targets run top to bottom — later targets only serve when earlier ones fail.
        </p>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
