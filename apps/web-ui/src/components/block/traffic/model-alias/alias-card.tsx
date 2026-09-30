import { IconChevronDown, IconChevronUp, IconPlus, IconReplace, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
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
] /**
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
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
          <IconReplace />
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} target{rows.length === 1 ? '' : 's'} in fallback order
            </p>
          )}
        </div>
        <Switch
          checked={active}
          onCheckedChange={setActive}
          aria-label={`Activate ${name || 'alias'}`}
        />
      </div>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">Context window</p>
        <Select value={String(contextWindow)} onValueChange={(v) => setContextWindow(Number(v))}>
          <SelectTrigger size="sm" className="mt-1.5 w-full max-w-xs">
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

      <div className="border-t border-border p-4">
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
                row.active ? 'border-border bg-background' : 'border-dashed border-border/60'
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <input
                value={row.provider}
                onChange={(e) => setRow(i, { provider: e.target.value })}
                placeholder="provider"
                aria-label={`Target ${i + 1} provider`}
                className={`h-7 min-w-0 flex-1 rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40 ${row.active ? '' : 'text-muted-foreground'}`}
              />
              <span className="text-muted-foreground/60">/</span>
              <input
                value={row.model}
                onChange={(e) => setRow(i, { model: e.target.value })}
                placeholder="model"
                aria-label={`Target ${i + 1} model`}
                className={`h-7 min-w-0 flex-[1.4] rounded bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/40 ${row.active ? '' : 'text-muted-foreground'}`}
              />
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  size="sm"
                  checked={row.active}
                  onCheckedChange={(v) => setRow(i, { active: v })}
                  aria-label={`Target ${i + 1} active`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move target ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => moveRow(i, -1)}
                >
                  <IconChevronUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move target ${i + 1} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => moveRow(i, 1)}
                >
                  <IconChevronDown />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove target ${i + 1}`}
                  onClick={() => removeRow(i)}
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
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        <Button
          variant="outline"
          disabled={!dirty || upsertMutation.isPending || nameError !== '' || partialRow}
          onClick={save}
        >
          Save pool
        </Button>
        <Button className={EMERALD_BUTTON_CLASS} onClick={addRow}>
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
