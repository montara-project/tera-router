import {
  IconChevronDown,
  IconCpu,
  IconFileDescription,
  IconGauge,
  IconWallet,
  IconX,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { FieldLabel, ModelPatternPicker } from '@/components/block/keys/form'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const PERIODS = ['daily', 'weekly', 'monthly'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_HINTS: Record<Period, string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

type Draft = {
  name: string
  description: string
  period: Period
  spend: string
  tokens: string
  rpm: string
  tpm: string
  concurrent: string
  alertPct: string
  hardCutoff: boolean
  models: string[]
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'

/** Older rows may store an out-of-enum period; fall back to the server default. */
function formPeriod(period: string | undefined): Period {
  return period && (PERIODS as readonly string[]).includes(period) ? (period as Period) : 'monthly'
}

// Stored 0 means the limit was cleared (= unlimited); show the "Unlimited"
// placeholder instead of a meaningless zero.
const limitText = (value: number | null | undefined) => (value ? String(value) : '')

function draftFrom(plan?: Models.Plan | null): Draft {
  return {
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    period: formPeriod(plan?.period),
    spend: limitText(plan?.budget_spend),
    tokens: limitText(plan?.budget_tokens),
    rpm: limitText(plan?.rpm),
    tpm: limitText(plan?.tpm),
    concurrent: limitText(plan?.concurrent),
    alertPct: String(plan?.alert_at_percent ?? 80),
    hardCutoff: plan?.hard_cutoff ?? true,
    models: plan?.allowed_models ?? [],
  }
}

/** Empty input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}

const digits = (raw: string) => raw.replace(/\D/g, '')

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Plan to edit; omit (or pass null) for create mode. */
  plan?: Models.Plan | null
}

/**
 * Create/edit dialog for one plan. Keyed by plan id + open state so every
 * open starts from fresh values instead of the previous session's.
 */
export default function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  return (
    <PlanForm
      key={`${plan?.id ?? 'new'}-${open}`}
      open={open}
      plan={plan}
      onOpenChange={onOpenChange}
    />
  )
}

export function Section({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3 border-b border-border px-5 pt-4 pb-[17px]', className)}>
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className="size-4 text-orange-600 dark:text-orange-400" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

function PlanForm({ open, plan, onOpenChange }: PlanFormDialogProps) {
  const id = useId()
  const editing = Boolean(plan?.id)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(plan))
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  // Open on edit when the plan already has rate limits, so they are not hidden.
  const [advanced, setAdvanced] = useState(Boolean(plan?.rpm || plan?.tpm || plan?.concurrent))

  const createMutation = useMutation(queries.plans.create())
  const updateMutation = useMutation(queries.plans.update(plan?.id ?? ''))
  const saving = createMutation.isPending || updateMutation.isPending

  const alert = Number(draft.alertPct)
  const error = !draft.name.trim()
    ? 'Name is required.'
    : draft.spend.trim() !== '' && !(Number(draft.spend) > 0)
      ? 'Spend limit must be more than 0.'
      : !(Number.isInteger(alert) && alert >= 1 && alert <= 100)
        ? 'Alert at must be between 1 and 100.'
        : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (error) {
      toast.error(error)
      return
    }
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      period: draft.period,
      // The server PATCH treats an omitted/null field as "keep the stored
      // value", so a cleared limit is sent as 0 (= unlimited) instead.
      budget_spend: parseLimit(draft.spend),
      budget_tokens: Math.round(parseLimit(draft.tokens)),
      rpm: Math.round(parseLimit(draft.rpm)),
      tpm: Math.round(parseLimit(draft.tpm)),
      concurrent: Math.round(parseLimit(draft.concurrent)),
      alert_at_percent: alert,
      hard_cutoff: draft.hardCutoff,
      allowed_models: draft.models,
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync(payload)
        toast.success('Plan updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Plan created')
      }
      onOpenChange(false)
    } catch (err) {
      toastAxiosError(err)
    }
  }

  const periodHint = PERIOD_HINTS[draft.period]
  const rateFields = [
    { key: 'rpm', label: 'Requests / min' },
    { key: 'tpm', label: 'Tokens / min' },
    { key: 'concurrent', label: 'Concurrent requests' },
  ] as const

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <AlertDialogTitle className="text-[15px]">
              {editing ? 'Edit plan' : 'Create plan'}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Budget, rate and model limits that API keys on this plan inherit.
            </AlertDialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>

          <div className="scrollbar-seamless min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Section icon={IconFileDescription} title="Details">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-name`} label="Name" hint="Required" />
                  <Input
                    id={`${id}-name`}
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Pro"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-description`} label="Description" hint="Optional" />
                  <Input
                    id={`${id}-description`}
                    value={draft.description}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder="Full access, $100 a month"
                    autoComplete="off"
                  />
                </div>
              </div>
            </Section>

            <Section icon={IconWallet} title="Budget per key">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-spend`} label="Spend limit (USD)" />
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted-foreground"
                      aria-hidden
                    >
                      $
                    </span>
                    <Input
                      id={`${id}-spend`}
                      inputMode="decimal"
                      className="pl-7"
                      value={draft.spend}
                      onChange={(e) => set({ spend: e.target.value.replace(/[^\d.]/g, '') })}
                      placeholder="Unlimited"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{periodHint}</p>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-tokens`} label="Token limit" />
                  <Input
                    id={`${id}-tokens`}
                    inputMode="numeric"
                    value={draft.tokens}
                    onChange={(e) => set({ tokens: digits(e.target.value) })}
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">{periodHint}</p>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-period`} label="Period" />
                  <select
                    id={`${id}-period`}
                    value={draft.period}
                    onChange={(e) => set({ period: e.target.value as Period })}
                    className={selectClass}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-alert`} label="Alert at" />
                  <div className="relative">
                    <Input
                      id={`${id}-alert`}
                      inputMode="numeric"
                      className="pr-8"
                      value={draft.alertPct}
                      onChange={(e) => set({ alertPct: digits(e.target.value) })}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground"
                      aria-hidden
                    >
                      %
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 self-end rounded-md border border-border px-[13px] py-[11px] sm:col-span-2">
                  <div className="min-w-0">
                    <label htmlFor={`${id}-cutoff`} className="block text-[12.5px] font-medium">
                      Hard cutoff
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Reject requests once a key reaches the limit.
                    </p>
                  </div>
                  <Switch
                    id={`${id}-cutoff`}
                    checked={draft.hardCutoff}
                    onCheckedChange={(hardCutoff) => set({ hardCutoff })}
                  />
                </div>
              </div>
            </Section>

            <Section icon={IconCpu} title="Models">
              <div className="space-y-1.5">
                <ModelPatternPicker
                  id={`${id}-models`}
                  value={draft.models}
                  onChange={(models) => set({ models })}
                />
                <p className="text-xs text-muted-foreground">
                  Empty allows every model. * wildcards work, e.g. claude-*.
                </p>
              </div>
            </Section>

            <section className="space-y-3 px-5 py-4">
              <button
                type="button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((v) => !v)}
                className="flex w-full items-center justify-between gap-3 rounded-md text-[13px] font-semibold"
              >
                <span className="flex items-center gap-2">
                  <IconGauge className="size-4 text-orange-600 dark:text-orange-400" aria-hidden />
                  Advanced: rate limits
                </span>
                <IconChevronDown
                  className={cn('size-4 text-muted-foreground', advanced && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {advanced ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {rateFields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <FieldLabel htmlFor={`${id}-${f.key}`} label={f.label} />
                      <Input
                        id={`${id}-${f.key}`}
                        inputMode="numeric"
                        value={draft[f.key]}
                        onChange={(e) => set({ [f.key]: digits(e.target.value) })}
                        placeholder="Unlimited"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
