import { IconChevronDown, IconChevronUp, IconPlus, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'

import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
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
    <SimpleDialog
      title={editing ? 'Edit Chain' : 'Create Chain'}
      description="Define an ordered set of provider/model steps the router walks through when the primary target cannot serve a request."
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
    >
      <ChainForm key={chain?.id ?? 'new'} chain={chain} onOpenChange={onOpenChange} />
    </SimpleDialog>
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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" asterisk placeholder="fast-fallback" />}
          </form.AppField>

          <form.AppField name="strategy">
            {(field) => <field.SelectField label="Strategy" options={CHAIN_STRATEGY_OPTIONS} />}
          </form.AppField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="context_window">
            {(field) => <field.NumberField label="Context window" placeholder="e.g. 128000" />}
          </form.AppField>

          <form.AppField name="enabled">
            {(field) => (
              <field.SwitchField
                label="Enabled"
                onCheckedChange={(checked) => field.handleChange(checked)}
              />
            )}
          </form.AppField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="fallback_provider">
            {(field) => <field.TextField label="Fallback provider" placeholder="optional" />}
          </form.AppField>

          <form.AppField name="fallback_model">
            {(field) => <field.TextField label="Fallback model" placeholder="optional" />}
          </form.AppField>
        </div>

        <form.AppField name="steps" mode="array">
          {(field) => {
            const rows = field.state.value
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Steps
                  </p>
                  <span className="text-xs text-muted-foreground">
                    walked in order as fallbacks
                  </span>
                </div>

                {rows.map((_, i) => (
                  <div
                    key={`step-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <form.AppField name={`steps[${i}].provider`}>
                      {(subField) => (
                        <input
                          value={subField.state.value}
                          onChange={(e) => subField.handleChange(e.target.value)}
                          onBlur={subField.handleBlur}
                          placeholder="provider"
                          aria-label={`Step ${i + 1} provider`}
                          className="h-7 min-w-0 flex-1 rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40"
                        />
                      )}
                    </form.AppField>
                    <span className="text-muted-foreground/60">/</span>
                    <form.AppField name={`steps[${i}].model`}>
                      {(subField) => (
                        <input
                          value={subField.state.value}
                          onChange={(e) => subField.handleChange(e.target.value)}
                          onBlur={subField.handleBlur}
                          placeholder="model"
                          aria-label={`Step ${i + 1} model`}
                          className="h-7 min-w-0 flex-[1.4] rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40"
                        />
                      )}
                    </form.AppField>
                    <span className="ml-auto flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Move step ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => field.moveValue(i, i - 1)}
                      >
                        <IconChevronUp />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Move step ${i + 1} down`}
                        disabled={i === rows.length - 1}
                        onClick={() => field.moveValue(i, i + 1)}
                      >
                        <IconChevronDown />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Remove step ${i + 1}`}
                        onClick={() => field.removeValue(i)}
                      >
                        <IconX />
                      </Button>
                    </span>
                  </div>
                ))}

                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    No steps yet — add the first provider/model this chain should try.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.pushFieldValue('steps', { provider: '', model: '' })
                  }
                >
                  <IconPlus /> Add step
                </Button>
              </div>
            )
          }}
        </form.AppField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting: boolean) => (
              <Button type="submit" disabled={isSubmitting || saving}>
                {isSubmitting || saving ? 'Saving…' : editing ? 'Save changes' : 'Create chain'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </form>
  )
}
