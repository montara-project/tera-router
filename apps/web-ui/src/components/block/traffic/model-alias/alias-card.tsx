import { IconChevronDown, IconChevronUp, IconPlus, IconReplace, IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'
import type { Option } from '@/types/select'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AliasTargetSchema } from '@/lib/api/dtos/alias/schema'
import { queries } from '@/lib/api/queries'
import { EMERALD_BUTTON_CLASS } from '@/lib/constants/ui'
import { requiredString } from '@/lib/validation'

/** Model combobox page size — the server caps the catalog page at 100. */
const MODEL_OPTIONS_LIMIT = 100

const CONTEXT_WINDOW_OPTIONS = [
  { value: 0, label: 'Default (unlimited)' },
  { value: 8192, label: '8K tokens' },
  { value: 16384, label: '16K tokens' },
  { value: 32768, label: '32K tokens' },
  { value: 65536, label: '64K tokens' },
  { value: 131072, label: '128K tokens' },
  { value: 200000, label: '200K tokens' },
  { value: 1000000, label: '1M tokens' },
]

const isPartialTarget = (r: Models.AliasTarget) =>
  (r.provider.trim() === '') !== (r.model.trim() === '')

/**
 * AliasSchema validates the wire payload, but the form carries the full
 * AliasTarget rows (id, position) so the editor schema widens each target
 * back to Models.AliasTarget.
 */
const AliasCardSchema = z.object({
  name: requiredString('name'),
  context_window: requiredString('context window'),
  active: z.boolean(),
  targets: z.array(
    AliasTargetSchema.extend({
      id: z.string(),
      alias_id: z.string(),
      position: z.number(),
      active: z.boolean(),
    })
  ),
})

/**
 * AliasCard edits one alias pool: name, active flag, context window, and the
 * ordered fallback targets. State lives in a TanStack Form instance until
 * "Save pool" upserts the whole pool (PUT replaces name, targets, and active
 * together server-side).
 */
export default function AliasCard({
  alias,
  isNew = false,
  onClose,
}: {
  alias: Models.ModelAlias
  isNew?: boolean
  onClose?: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const upsertMutation = useMutation(queries.aliases.upsert())
  const removeMutation = useMutation(queries.aliases.remove())

  const form = useAppForm({
    defaultValues: {
      name: alias.name,
      context_window: String(alias.context_window),
      active: alias.active,
      targets: alias.targets,
    },
    validators: {
      onSubmit: AliasCardSchema,
      onChange: AliasCardSchema,
    },
    onSubmit: async ({ value }) => {
      const targets = value.targets
        .filter((r) => r.provider.trim() !== '' && r.model.trim() !== '')
        .map((r) => ({ provider: r.provider.trim(), model: r.model.trim(), active: r.active }))
      if (targets.length === 0) {
        toast.error('Add at least one complete provider/model target')
        return
      }
      try {
        await upsertMutation.mutateAsync({
          name: value.name.trim(),
          context_window: Number(value.context_window) || undefined,
          active: value.active,
          targets,
        })
        toast.success(isNew ? 'Alias created' : 'Alias pool saved')
        onClose?.()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  const targetCount = useSelector(form.store, (s) => s.values.targets.length)
  const saveDisabled = useSelector(
    form.store,
    (s) => !s.isDirty || s.values.targets.some(isPartialTarget)
  )

  // Provider combobox lists the catalog + custom providers; model comboboxes
  // read the selected provider's stored catalog (limit = server page cap).
  const providersQuery = useQuery(queries.providers.list())
  const providersOverview = providersQuery.data?.data
  const providers = [
    ...(providersOverview?.connected ?? []),
    ...(providersOverview?.available ?? []),
  ]
  const providerOptions: Option<string>[] = providers.map((p) => ({
    value: p.slug,
    label: p.name || p.slug,
  }))

  const targetProviderKey = useSelector(form.store, (s) =>
    [...new Set(s.values.targets.map((t) => t.provider.trim()).filter(Boolean))].join('\u0000')
  )
  const targetProviders = targetProviderKey ? targetProviderKey.split('\u0000') : []

  const modelQueries = useQueries({
    queries: targetProviders.map((slug) => {
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
  targetProviders.forEach((slug, i) => {
    // Keep the client filter as a guard for servers predating the state param.
    const models = (modelQueries[i]?.data?.data?.models ?? []).filter(
      (model) => model.state === 'active'
    )
    modelOptionsBySlug.set(
      slug,
      models.map((model) => ({ value: model.id, label: model.id }))
    )
  })

  const remove = async () => {
    try {
      await removeMutation.mutateAsync(alias.name)
      toast.success('Alias deleted')
    } catch {
      toast.error('Failed to delete alias')
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
          <IconReplace />
        </span>
        <form.AppField name="name">
          {(field) => {
            const nameError = field.state.meta.errors[0]?.message ?? ''
            return (
              <div className="min-w-0 flex-1">
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  readOnly={!isNew}
                  placeholder="alias-name"
                  aria-label="Alias name"
                  aria-invalid={nameError !== ''}
                  className={`h-9 w-full max-w-xs rounded-md border bg-background px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    nameError ? 'border-destructive/60' : 'border-border'
                  } ${!isNew ? 'cursor-default' : ''}`}
                />
                {nameError ? (
                  <p className="mt-1 text-xs text-destructive">{nameError}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {targetCount} target{targetCount === 1 ? '' : 's'} in fallback order
                  </p>
                )}
              </div>
            )
          }}
        </form.AppField>
        <form.AppField name="active">
          {(field) => (
            <span className="flex items-center gap-2">
              <Badge
                variant={field.state.value ? 'success' : 'secondary'}
                appearance="light"
                size="sm"
              >
                <BadgeDot />
                {field.state.value ? 'Active' : 'Inactive'}
              </Badge>
              <Switch
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                aria-label={`Activate ${alias.name || 'alias'}`}
              />
            </span>
          )}
        </form.AppField>
      </div>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">Context window</p>
        <form.AppField name="context_window">
          {(field) => (
            <field.SelectField
              className="mt-1.5 w-full max-w-xs"
              options={CONTEXT_WINDOW_OPTIONS.map((o) => ({
                value: String(o.value),
                label: o.label,
              }))}
            />
          )}
        </form.AppField>
      </div>

      <div className="border-t border-border p-4">
        <form.AppField name="targets" mode="array">
          {(field) => {
            const rows = field.state.value
            const partialRow = rows.some(isPartialTarget)
            const activeCount = rows.filter((r) => r.active && r.provider.trim() !== '').length
            return (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fallback order
                  </p>
                  <span className="text-xs text-muted-foreground">{activeCount} active</span>
                </div>
                <div className="mt-3 space-y-2">
                  {rows.map((row, i) => (
                    <div
                      key={row.id || `new-${i}`}
                      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
                        row.active
                          ? 'border-border bg-background'
                          : 'border-dashed border-border/60 opacity-70'
                      }`}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs tabular-nums text-muted-foreground">
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
                      <form.AppField name={`targets[${i}].model`}>
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
                      <span className="ml-auto flex items-center gap-2">
                        <form.AppField name={`targets[${i}].active`}>
                          {(subField) => (
                            <>
                              <Badge
                                variant={subField.state.value ? 'success' : 'secondary'}
                                appearance="light"
                                size="sm"
                              >
                                <BadgeDot />
                                {subField.state.value ? 'Active' : 'Inactive'}
                              </Badge>
                              <Switch
                                size="sm"
                                checked={subField.state.value}
                                onCheckedChange={subField.handleChange}
                                aria-label={`Target ${i + 1} active`}
                              />
                            </>
                          )}
                        </form.AppField>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move target ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => field.moveValue(i, i - 1)}
                        >
                          <IconChevronUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move target ${i + 1} down`}
                          disabled={i === rows.length - 1}
                          onClick={() => field.moveValue(i, i + 1)}
                        >
                          <IconChevronDown />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove target ${i + 1}`}
                          onClick={() => field.removeValue(i)}
                        >
                          <IconX />
                        </Button>
                      </span>
                    </div>
                  ))}
                  {rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No targets yet — add the first provider/model this alias should try.
                    </p>
                  ) : null}
                  {partialRow ? (
                    <p className="text-xs text-destructive">
                      Every target needs both a provider and a model before saving.
                    </p>
                  ) : null}
                </div>
              </>
            )
          }}
        </form.AppField>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        <Button
          variant="outline"
          disabled={saveDisabled || upsertMutation.isPending}
          onClick={() => form.handleSubmit()}
          className="h-10"
        >
          Save pool
        </Button>

        <Button
          className={EMERALD_BUTTON_CLASS}
          onClick={() =>
            form.pushFieldValue('targets', {
              id: '',
              alias_id: alias.id,
              position: form.state.values.targets.length + 1,
              provider: '',
              model: '',
              active: true,
            })
          }
        >
          <IconPlus /> Add target
        </Button>

        {!isNew ? (
          <Button
            variant="outline"
            className="ml-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        ) : (
          <Button variant="outline" className="ml-auto" onClick={() => onClose?.()}>
            Cancel
          </Button>
        )}
      </div>

      <SimpleAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete alias?"
        description={`Delete ${alias.name}? Keys and plans referencing it will no longer resolve.`}
        confirmText="Delete alias"
        onConfirm={remove}
        variant="destructive"
      />
    </div>
  )
}
