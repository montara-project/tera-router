import { IconChevronDown, IconChevronUp, IconPlus, IconStack2, IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import z from 'zod'

import type { Models } from '@/lib/api/models'

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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" asterisk placeholder="fast-fallback" />}
          </form.AppField>

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

                {rows.map((_, i) => (
                  <div
                    key={`step-${i}`}
                    className="border-border hover:bg-muted/30 group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-semibold tabular-nums text-blue-600 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
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
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="provider"
                  aria-label="Terminal fallback provider"
                  className="h-7 min-w-0 flex-1 rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40"
                />
              )}
            </form.AppField>
            <span className="text-muted-foreground/60">/</span>
            <form.AppField name="fallback_model">
              {(field) => (
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="model"
                  aria-label="Terminal fallback model"
                  className="h-7 min-w-0 flex-[1.4] rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40"
                />
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
