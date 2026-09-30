import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconRefresh,
  IconReplace,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { queries } from '@/lib/api/queries'

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

/**
 * AliasCard edits one alias pool: name, active flag, context window, and the
 * ordered fallback targets. State is local until "Save pool" upserts the
 * whole pool (PUT replaces name, targets, and active together server-side).
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
  const [name, setName] = useState(alias.name)
  const [nameTouched, setNameTouched] = useState(false)
  const [contextWindow, setContextWindow] = useState(alias.context_window)
  const [active, setActive] = useState(alias.active)
  const [rows, setRows] = useState<Models.AliasTarget[]>(alias.targets)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const upsertMutation = useMutation(queries.aliases.upsert())
  const removeMutation = useMutation(queries.aliases.remove())

  const nameError = nameTouched && name.trim() === '' ? 'Alias name is required' : ''
  const partialRow = rows.some((r) => (r.provider.trim() === '') !== (r.model.trim() === ''))

  const dirty = useMemo(() => {
    if (name !== alias.name || contextWindow !== alias.context_window || active !== alias.active)
      return true
    const before = alias.targets.map((t) => `${t.provider}/${t.model}/${t.active}`).join('|')
    const after = rows.map((t) => `${t.provider}/${t.model}/${t.active}`).join('|')
    return before !== after
  }, [alias, name, contextWindow, active, rows])

  const activeCount = rows.filter((r) => r.active && r.provider.trim() !== '').length
  const canSave = dirty && !upsertMutation.isPending && nameError === '' && !partialRow

  const setRow = (index: number, patch: Partial<Models.AliasTarget>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: '',
        alias_id: alias.id,
        position: prev.length + 1,
        provider: '',
        model: '',
        active: true,
      },
    ])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const reset = () => {
    setName(alias.name)
    setNameTouched(false)
    setContextWindow(alias.context_window)
    setActive(alias.active)
    setRows(alias.targets)
  }

  const save = async () => {
    setNameTouched(true)
    if (name.trim() === '' || partialRow) return
    const targets = rows
      .filter((r) => r.provider.trim() !== '' && r.model.trim() !== '')
      .map((r) => ({ provider: r.provider.trim(), model: r.model.trim(), active: r.active }))
    if (targets.length === 0) {
      toast.error('Add at least one complete provider/model target')
      return
    }
    try {
      await upsertMutation.mutateAsync({
        name: name.trim(),
        context_window: contextWindow || undefined,
        active,
        targets,
      })
      toast.success(isNew ? 'Alias created' : 'Alias pool saved')
      onClose?.()
    } catch (err) {
      const detail = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      toast.error(detail || 'Failed to save alias pool')
    }
  }

  const remove = async () => {
    try {
      await removeMutation.mutateAsync(alias.name)
      toast.success('Alias deleted')
    } catch {
      toast.error('Failed to delete alias')
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background transition-colors focus-within:border-ring/40">
      {/* Header: identity, status, and the pool-level switch. */}
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60">
          <IconReplace className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Looks like a heading until hovered/focused — the affordance for
                renaming without a separate edit mode. */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="alias-name"
              aria-label="Alias name"
              aria-invalid={nameError !== ''}
              aria-describedby={nameError ? 'alias-name-error' : undefined}
              className={`-ml-2 h-8 w-full max-w-64 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold outline-none transition-colors hover:border-input hover:bg-muted/40 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 ${
                nameError ? 'border-destructive/60' : ''
              }`}
            />
            <Badge variant={active ? 'success' : 'secondary'} appearance="light" size="sm">
              <BadgeDot />
              {active ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length} target{rows.length === 1 ? '' : 's'} in fallback order · {activeCount}{' '}
            active
          </p>
          {nameError ? (
            <p id="alias-name-error" className="mt-1 text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>

        <Switch
          checked={active}
          onCheckedChange={setActive}
          aria-label={`${active ? 'Disable' : 'Enable'} ${name || 'alias'}`}
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium">Context window</p>
            <p className="text-xs text-muted-foreground">
              Overrides the per-model window for every target in this pool.
            </p>
          </div>
          <Select value={String(contextWindow)} onValueChange={(v) => setContextWindow(Number(v))}>
            <SelectTrigger size="sm" className="w-full max-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTEXT_WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fallback order
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">{activeCount} active</span>
        </div>

        <div className="mt-3 space-y-1.5">
          {rows.map((row, i) => (
            <div
              key={row.id || `new-${i}`}
              className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                row.active
                  ? 'border-border bg-background hover:bg-muted/30'
                  : 'border-dashed border-border/70 bg-muted/10'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs tabular-nums ${
                  row.active
                    ? 'bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </span>

              {/* One field unit so the provider/model pair reads as a single
                  routing coordinate rather than two loose inputs. */}
              <div
                className={`flex min-w-0 flex-1 items-center gap-0.5 rounded-md px-2 py-0.5 transition-colors focus-within:bg-background focus-within:ring-1 focus-within:ring-ring/40 ${
                  row.active ? 'bg-muted/40' : 'bg-transparent'
                }`}
              >
                <input
                  value={row.provider}
                  onChange={(e) => setRow(i, { provider: e.target.value })}
                  placeholder="provider"
                  aria-label={`Target ${i + 1} provider`}
                  className={`h-6 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/50 ${
                    row.active ? '' : 'text-muted-foreground'
                  }`}
                />
                <span className="select-none text-muted-foreground/50">/</span>
                <input
                  value={row.model}
                  onChange={(e) => setRow(i, { model: e.target.value })}
                  placeholder="model"
                  aria-label={`Target ${i + 1} model`}
                  className={`h-6 min-w-0 flex-[1.4] bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/50 ${
                    row.active ? '' : 'text-muted-foreground'
                  }`}
                />
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Switch
                  size="sm"
                  checked={row.active}
                  onCheckedChange={(v) => setRow(i, { active: v })}
                  aria-label={`Target ${i + 1} active`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Move target ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => moveRow(i, -1)}
                >
                  <IconChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Move target ${i + 1} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => moveRow(i, 1)}
                >
                  <IconChevronDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove target ${i + 1}`}
                  onClick={() => removeRow(i)}
                >
                  <IconX className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No targets yet — add the first provider/model this alias should try.
              </p>
              <Button size="sm" variant="outline" onClick={addRow}>
                <IconPlus /> Add target
              </Button>
            </div>
          ) : null}

          {partialRow ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <IconAlertTriangle className="size-3.5 shrink-0" />
              Every target needs both a provider and a model before saving.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
        <Button className={EMERALD_BUTTON_CLASS} disabled={!canSave} onClick={save}>
          {upsertMutation.isPending ? <IconRefresh className="animate-spin" /> : <IconCheck />}
          {isNew ? 'Create alias' : 'Save pool'}
        </Button>
        {rows.length > 0 ? (
          <Button variant="outline" onClick={addRow}>
            <IconPlus /> Add target
          </Button>
        ) : null}

        {dirty ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {dirty && !isNew ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <IconArrowBackUp /> Reset
            </Button>
          ) : null}
          {!isNew ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <IconTrash /> Delete
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
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
