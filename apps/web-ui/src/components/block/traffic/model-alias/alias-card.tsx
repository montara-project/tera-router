import { IconChevronDown, IconChevronUp, IconPlus, IconReplace, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AliasTargetSchema } from '@/lib/api/dtos/alias/schema'
import { queries } from '@/lib/api/queries'
import { requiredString } from '@/lib/validation'

const EMERALD_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-500/90 dark:bg-emerald-600 dark:hover:bg-emerald-500/90'

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
                  placeholder="alias-name"
                  aria-label="Alias name"
                  aria-invalid={nameError !== ''}
                  className={`h-9 w-full max-w-xs rounded-md border bg-background px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    nameError ? 'border-destructive/60' : 'border-border'
                  }`}
                />
                {nameError ? (
                  <p className="mt-1 text-xs text-destructive">{nameError}</p>
                ) : (
                  <form.Subscribe selector={(state) => state.values.targets.length}>
                    {(count) => (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {count} target{count === 1 ? '' : 's'} in fallback order
                      </p>
                    )}
                  </form.Subscribe>
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
                          <input
                            value={subField.state.value}
                            onChange={(e) => subField.handleChange(e.target.value)}
                            onBlur={subField.handleBlur}
                            placeholder="provider"
                            aria-label={`Target ${i + 1} provider`}
                            className={`h-7 min-w-0 flex-1 rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40 ${row.active ? '' : 'text-muted-foreground'}`}
                          />
                        )}
                      </form.AppField>
                      <span className="text-muted-foreground/60">/</span>
                      <form.AppField name={`targets[${i}].model`}>
                        {(subField) => (
                          <input
                            value={subField.state.value}
                            onChange={(e) => subField.handleChange(e.target.value)}
                            onBlur={subField.handleBlur}
                            placeholder="model"
                            aria-label={`Target ${i + 1} model`}
                            className={`h-7 min-w-0 flex-[1.4] rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40 ${row.active ? '' : 'text-muted-foreground'}`}
                          />
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
        <form.Subscribe
          selector={(state) => !state.isDirty || state.values.targets.some(isPartialTarget)}
        >
          {(disabled) => (
            <Button
              variant="outline"
              disabled={disabled || upsertMutation.isPending}
              onClick={() => form.handleSubmit()}
              className="h-10"
            >
              Save pool
            </Button>
          )}
        </form.Subscribe>

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
        ) : null}
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
