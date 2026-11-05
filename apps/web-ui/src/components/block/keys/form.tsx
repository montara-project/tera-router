import { IconChevronDown, IconSearch, IconSelector, IconX } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type Period = 'daily' | 'weekly' | 'monthly'

type Draft = {
  name: string
  planId: string
  limitUsd: string
  limitTokens: string
  period: Period
  models: string[]
  alertPct: string
  hardCutoff: boolean
}

const EMPTY: Draft = {
  name: '',
  planId: '',
  limitUsd: '',
  limitTokens: '',
  period: 'monthly',
  models: [],
  alertPct: '80',
  hardCutoff: true,
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'

/** Label row with a muted hint on the right, as in the other forms. */
export function FieldLabel({
  htmlFor,
  label,
  hint,
}: {
  htmlFor: string
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium">
        {label}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

type AddKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the stored key (with full_key) to show the one-time secret dialog. */
  onCreated?: (key: Models.ApiKey) => void
}

/** Keyed by open state so every open starts from an empty form. */
export function AddKeyForm(props: AddKeyFormProps) {
  return <CreateKeyDialog key={String(props.open)} {...props} />
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: AddKeyFormProps) {
  const id = useId()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [advanced, setAdvanced] = useState(false)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const plansQuery = useQuery(queries.plans.list())
  const plans = plansQuery.data?.data ?? []
  const plan = plans.find((p) => p.id === draft.planId)

  const createKey = useMutation(queries.keys.create())
  const createBudget = useMutation(queries.budgets.create())
  const saving = createKey.isPending || createBudget.isPending

  const usd = draft.limitUsd.trim() === '' ? undefined : Number(draft.limitUsd)
  const tokens = draft.limitTokens.trim() === '' ? undefined : Number(draft.limitTokens)
  const alert = Number(draft.alertPct)
  const hasLimit = usd !== undefined || tokens !== undefined
  const error = !draft.name.trim()
    ? 'Name is required.'
    : usd !== undefined && !(usd > 0)
      ? 'Limit (USD) must be more than 0.'
      : tokens !== undefined && !(Number.isInteger(tokens) && tokens > 0)
        ? 'Limit (tokens) must be a whole number above 0.'
        : hasLimit && !(Number.isInteger(alert) && alert >= 1 && alert <= 100)
          ? 'Alert at must be between 1 and 100.'
          : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (error) {
      toast.error(error)
      return
    }
    let key: Models.ApiKey
    try {
      const res = await createKey.mutateAsync({
        name: draft.name.trim(),
        plan_id: draft.planId || undefined,
        allowed_models: draft.models.length ? draft.models : undefined,
      })
      key = res.data
    } catch (err) {
      toastAxiosError(err)
      return
    }

    // The key exists from here on; a budget failure is reported, not hidden,
    // and the secret is still shown because it is the only chance to copy it.
    if (hasLimit) {
      try {
        await createBudget.mutateAsync({
          scope_kind: 'api_key',
          scope_id: key.id,
          budget_spend: usd,
          limit_tokens: tokens,
          period: draft.period,
          alert_pct: alert,
          hard_cutoff: draft.hardCutoff,
        })
      } catch (err) {
        toastAxiosError(err)
        toast.error('Key created without its limit. Add the budget under Plans & budgets.')
      }
    }

    onOpenChange(false)
    onCreated?.(key)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <AlertDialogTitle className="text-[15px]">Create API key</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              The key is shown once after it is created.
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

          <div className="scrollbar-seamless min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-name`} label="Name" hint="Required" />
              <Input
                id={`${id}-name`}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Cursor on my laptop"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-plan`} label="Plan" />
              <select
                id={`${id}-plan`}
                value={draft.planId}
                onChange={(e) => set({ planId: e.target.value })}
                className={selectClass}
              >
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {plan
                  ? plan.description || `Limits and models follow ${plan.name}.`
                  : 'No plan. Set limits under Advanced.'}
              </p>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <button
                type="button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((v) => !v)}
                className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium hover:bg-muted/40"
              >
                Advanced · limits and models
                <IconChevronDown
                  className={cn('size-4 text-muted-foreground', advanced && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {advanced ? (
                <div className="space-y-4 border-t border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor={`${id}-usd`} label="Limit (USD)" hint="Optional" />
                      <Input
                        id={`${id}-usd`}
                        inputMode="decimal"
                        value={draft.limitUsd}
                        onChange={(e) => set({ limitUsd: e.target.value.replace(/[^\d.]/g, '') })}
                        placeholder="50.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor={`${id}-tokens`} label="Limit (tokens)" hint="Optional" />
                      <Input
                        id={`${id}-tokens`}
                        inputMode="numeric"
                        value={draft.limitTokens}
                        onChange={(e) => set({ limitTokens: e.target.value.replace(/\D/g, '') })}
                        placeholder="100000000"
                      />
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

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${id}-models`} label="Allowed models" hint="Optional" />
                    <ModelPatternPicker
                      id={`${id}-models`}
                      value={draft.models}
                      onChange={(models) => set({ models })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Empty allows every model. * matches many, e.g. claude-*.
                    </p>
                  </div>

                  <div
                    className={cn(
                      'divide-y divide-border rounded-md border border-border',
                      !hasLimit && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <label htmlFor={`${id}-alert`} className="text-[13px] font-medium">
                        Alert at
                      </label>
                      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Input
                          id={`${id}-alert`}
                          inputMode="numeric"
                          className="w-20 text-right"
                          disabled={!hasLimit}
                          value={draft.alertPct}
                          onChange={(e) => set({ alertPct: e.target.value.replace(/\D/g, '') })}
                        />
                        % of budget
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-[13px] font-medium">
                        Block requests when the budget is used up
                      </span>
                      <Switch
                        checked={draft.hardCutoff}
                        disabled={!hasLimit}
                        onCheckedChange={(hardCutoff) => set({ hardCutoff })}
                        aria-label="Block requests when the budget is used up"
                      />
                    </div>
                  </div>
                  {!hasLimit ? (
                    <p className="text-xs text-muted-foreground">
                      Alert and block apply once a USD or token limit is set.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {saving ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Multi-select of model ids with free-form patterns such as claude-*. */
export function ModelPatternPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const modelsQuery = useQuery(queries.playground.models())
  const ids = (modelsQuery.data?.data ?? []).map((m) => m.id)
  const typed = search.trim()

  const toggle = (model: string) =>
    onChange(value.includes(model) ? value.filter((m) => m !== model) : [...value, model])

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <IconSearch className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">
              {value.length ? `${value.length} selected` : 'Search and select models…'}
            </span>
            <IconSelector className="size-4 shrink-0" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput
              placeholder="Model id or pattern, e.g. claude-*"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64 overscroll-contain">
              <CommandEmpty>No model matches.</CommandEmpty>
              {typed && !ids.includes(typed) && !value.includes(typed) ? (
                <CommandGroup heading="Pattern">
                  <CommandItem
                    value={`add:${typed}`}
                    onSelect={() => {
                      onChange([...value, typed])
                      setSearch('')
                    }}
                  >
                    Add “{typed}”
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Models">
                {ids.map((model) => (
                  <CommandItem key={model} value={model} onSelect={() => toggle(model)}>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{model}</span>
                    {value.includes(model) ? (
                      <span className="text-xs text-muted-foreground">Selected</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Allowed models">
          {value.map((model) => (
            <li
              key={model}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 py-0.5 ps-1.5 pe-0.5 font-mono text-xs"
            >
              {model}
              <button
                type="button"
                aria-label={`Remove ${model}`}
                onClick={() => toggle(model)}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
