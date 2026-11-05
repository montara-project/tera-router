import { IconTarget, IconWallet, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BudgetScopeKind } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import { FieldLabel } from '@/components/block/keys/form'
import { Section } from '@/components/block/plans/form'
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

type Period = Models.Budget['period']

export const SCOPE_LABELS: Record<BudgetScopeKind, string> = {
  tenant: 'Whole instance',
  api_key: 'API key',
  account: 'Provider account',
}

/** Label of the second "Applies to" field, and what the cutoff stops. */
const SCOPE_TARGET: Record<BudgetScopeKind, { field: string; noun: string }> = {
  tenant: { field: '', noun: 'the instance' },
  api_key: { field: 'Key', noun: 'the key' },
  account: { field: 'Account', noun: 'the account' },
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'

const digits = (raw: string) => raw.replace(/\D/g, '')

/** Empty input means "no limit"; the server stores 0 as unlimited. */
function parseLimit(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value > 0 ? value : 0
}

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Budget to edit; omit for create mode. */
  budget?: Models.Budget | null
  /** Options for the api_key and account scopes. */
  scopeOptions: Record<'api_key' | 'account', Option<unknown>[]>
}

/** Create/edit dialog for one budget, keyed so every open starts fresh. */
export default function BudgetFormDialog(props: BudgetFormDialogProps) {
  return <BudgetForm key={`${props.budget?.id ?? 'new'}-${props.open}`} {...props} />
}

function BudgetForm({ open, onOpenChange, budget, scopeOptions }: BudgetFormDialogProps) {
  const id = useId()
  const editing = Boolean(budget?.id)
  const [scopeKind, setScopeKind] = useState<BudgetScopeKind>(budget?.scope_kind ?? 'api_key')
  const [scopeId, setScopeId] = useState(budget?.scope_id ?? '')
  const [period, setPeriod] = useState<Period>(budget?.period ?? 'monthly')
  // A stored 0 means "no limit"; show the placeholder instead.
  const [spend, setSpend] = useState(
    budget?.limit_micros ? String(budget.limit_micros / 1_000_000) : ''
  )
  const [tokens, setTokens] = useState(budget?.limit_tokens ? String(budget.limit_tokens) : '')
  const [alertPct, setAlertPct] = useState(String(budget?.alert_pct ?? 80))
  const [hardCutoff, setHardCutoff] = useState(budget?.hard_cutoff ?? true)

  const createMutation = useMutation(queries.budgets.create())
  const updateMutation = useMutation(queries.budgets.update(budget?.id ?? ''))
  const saving = createMutation.isPending || updateMutation.isPending

  const target = SCOPE_TARGET[scopeKind]
  const options = scopeKind === 'tenant' ? [] : scopeOptions[scopeKind]
  const alert = Number(alertPct)
  const error =
    scopeKind !== 'tenant' && !scopeId
      ? `Pick the ${target.field.toLowerCase()} this budget applies to.`
      : spend.trim() !== '' && !(Number(spend) > 0)
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
      scope_kind: scopeKind,
      scope_id: scopeKind === 'tenant' ? undefined : scopeId,
      period,
      // A cleared limit is sent as 0 (= unlimited): PATCH keeps omitted fields.
      budget_spend: parseLimit(spend),
      limit_tokens: Math.round(parseLimit(tokens)),
      alert_pct: alert,
      hard_cutoff: hardCutoff,
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync(payload)
        toast.success('Budget updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Budget created')
      }
      onOpenChange(false)
    } catch (err) {
      toastAxiosError(err)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <AlertDialogTitle className="text-[15px]">
              {editing ? 'Edit budget' : 'New budget'}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Cap spend or tokens per period for the whole instance, one API key or one provider
              account.
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
            <Section icon={IconTarget} title="Applies to">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-scope`} label="Scope" />
                  <select
                    id={`${id}-scope`}
                    value={scopeKind}
                    onChange={(e) => {
                      setScopeKind(e.target.value as BudgetScopeKind)
                      setScopeId('')
                    }}
                    className={selectClass}
                  >
                    {(Object.keys(SCOPE_LABELS) as BudgetScopeKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {SCOPE_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                {scopeKind === 'tenant' ? (
                  <p className="self-end pb-2 text-xs text-muted-foreground">
                    Counts every request through this instance.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${id}-target`} label={target.field} hint="Required" />
                    <select
                      id={`${id}-target`}
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="" disabled>
                        Select {target.field.toLowerCase()}…
                      </option>
                      {/* The stored key or account may be gone; keep its id selectable. */}
                      {scopeId && !options.some((o) => String(o.value) === scopeId) ? (
                        <option value={scopeId}>{scopeId} (not found)</option>
                      ) : null}
                      {options.map((o) => (
                        <option key={String(o.value)} value={String(o.value)}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Section>

            <Section icon={IconWallet} title="Limit" className="border-b-0 pb-4">
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
                      value={spend}
                      onChange={(e) => setSpend(e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder="Unlimited"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-tokens`} label="Token limit" />
                  <Input
                    id={`${id}-tokens`}
                    inputMode="numeric"
                    value={tokens}
                    onChange={(e) => setTokens(digits(e.target.value))}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${id}-period`} label="Period" />
                  <select
                    id={`${id}-period`}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as Period)}
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
                      value={alertPct}
                      onChange={(e) => setAlertPct(digits(e.target.value))}
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
                      Reject requests once {target.noun} reaches the limit.
                    </p>
                  </div>
                  <Switch
                    id={`${id}-cutoff`}
                    checked={hardCutoff}
                    onCheckedChange={setHardCutoff}
                  />
                </div>
              </div>
            </Section>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
