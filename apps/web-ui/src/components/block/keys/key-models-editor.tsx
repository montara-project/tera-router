import { IconCpu, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { useId, useMemo, useState } from 'react'

import SelectInput from '@/components/block/common/select-input'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { useChainModelGroups } from '@/components/block/traffic/chains/chain-model-picker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

export type ModelRow = {
  id: string
  model: string
  slug: string
  provider: string
  apiKind?: string
}

/** Active models of every usable provider, flattened to `provider/model` rows. */
export function useModelRows() {
  const { groups, apiKinds, loading } = useChainModelGroups()
  const rows = useMemo<ModelRow[]>(
    () =>
      groups.flatMap((g) =>
        g.models.map((model) => ({
          id: `${g.slug}/${model}`,
          model,
          slug: g.slug,
          provider: g.name,
          apiKind: g.apiKind ?? apiKinds.get(g.slug),
        }))
      ),
    [groups, apiKinds]
  )
  return { rows, groups, loading }
}

/** Model and Provider cells shared by the allowlist list and editor. */
export function ModelCells({ row }: { row: ModelRow | { id: string } }) {
  const known = 'slug' in row
  return (
    <>
      <td className="max-w-0 px-2 py-2.5 first:pl-4">
        <span className="block truncate font-medium" title={known ? row.model : row.id}>
          {known ? row.model : row.id}
        </span>
        <span
          className={cn('block truncate text-[11.5px] text-muted-foreground', known && 'font-mono')}
          title={known ? row.id : undefined}
        >
          {known ? row.id : 'Pattern'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {known ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <ProviderAvatar slug={row.slug} apiKind={row.apiKind} size="xs" />
            <span className="truncate">{row.provider}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Any matching provider</span>
        )}
      </td>
    </>
  )
}

interface KeyModelsEditorProps {
  /** the key's current allowlist */
  initial: string[]
  saving: boolean
  /** shown in the footer once the selection is valid */
  note: React.ReactNode
  onDiscard: () => void
  onSave: (patterns: string[]) => void
  /** clears the restriction; offered only when the key has one */
  onAllowAll?: () => void
}

/**
 * Inline allowlist editor. Ticked models are saved as exact `provider/model`
 * ids; anything else (wildcards, bare ids, chain:name) is kept as a pattern.
 */
export default function KeyModelsEditor({
  initial,
  saving,
  note,
  onDiscard,
  onSave,
  onAllowAll,
}: KeyModelsEditorProps) {
  const id = useId()
  const { rows, groups, loading } = useModelRows()
  const [selected, setSelected] = useState<string[]>(initial)
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [view, setView] = useState<'all' | 'selected'>('all')
  const [pattern, setPattern] = useState('')
  const [page, setPage] = useState(0)

  const rowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows])
  // Selections that are not a listed model: wildcards, bare ids, chains, or
  // models whose provider is no longer usable.
  const patterns = selected.filter((p) => !rowIds.has(p))

  const query = search.trim().toLowerCase()
  const filtered = rows.filter(
    (r) =>
      (!provider || r.slug === provider) &&
      (view === 'all' || selected.includes(r.id)) &&
      (!query || r.id.toLowerCase().includes(query))
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const toggle = (value: string, on: boolean) =>
    setSelected((s) => (on ? [...s, value] : s.filter((v) => v !== value)))

  const addPattern = () => {
    const value = pattern.trim()
    if (value && !selected.includes(value)) setSelected((s) => [...s, value])
    setPattern('')
  }

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(0)
    }

  return (
    <DashboardPanel icon={IconCpu} title="Edit allowed models">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <InputWrapper className="w-full sm:w-64">
          <IconSearch aria-hidden />
          <Input
            type="search"
            aria-label="Filter models"
            placeholder="Filter models"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </InputWrapper>
        <SelectInput
          aria-label="Provider"
          value={provider}
          onSelect={resetPage(setProvider)}
          className="w-full sm:w-44"
          options={[
            { value: '', label: 'All providers' },
            ...groups.map((g) => ({ value: g.slug, label: g.name })),
          ]}
        />
        <div role="group" aria-label="Show" className="flex gap-1">
          {(['all', 'selected'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => resetPage(setView)(v)}
              className={cn(
                'inline-flex h-8 items-center rounded-md border px-2.5 text-[12.5px] font-medium',
                view === v
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {v === 'all' ? 'All' : `Selected · ${selected.length}`}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">
          {formatCount(filtered.length)} shown
        </span>
      </div>

      <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addPattern()
          }}
        >
          <label htmlFor={`${id}-pattern`} className="shrink-0 text-[12.5px] font-medium">
            Add pattern
          </label>
          <Input
            id={`${id}-pattern`}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. gpt-4o*"
            autoComplete="off"
            className="h-8 flex-1 font-mono text-[12.5px]"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!pattern.trim()}>
            <IconPlus />
            Add
          </Button>
        </form>
        {patterns.length > 0 ? (
          <ul aria-label="Patterns" className="flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background py-0.5 pr-0.5 pl-2 font-mono text-xs"
              >
                {p}
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={() => toggle(p, false)}
                  className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-12 py-2 pr-2 pl-4">
                <span className="sr-only">Allowed</span>
              </th>
              <th className="px-2 py-2 text-left font-medium">Model</th>
              <th className="w-[28%] px-4 py-2 text-left font-medium">Provider</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={3} className="px-4 py-2.5">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  {rows.length === 0
                    ? 'No usable provider has active models yet. Add a pattern instead.'
                    : 'No models match. Try another filter.'}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const checked = selected.includes(r.id)
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-2 pl-4">
                      <Checkbox
                        aria-label={`Allow ${r.id}`}
                        checked={checked}
                        onCheckedChange={(on) => toggle(r.id, on === true)}
                      />
                    </td>
                    <ModelCells row={r} />
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="Model pages"
        className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2"
      >
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCount(rows.length)} total
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="px-3 text-xs font-medium tabular-nums">
            {current + 1} / {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
        <p
          aria-live="polite"
          className={cn(
            'min-w-0 flex-1 text-[12.5px]',
            selected.length === 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
          )}
        >
          {selected.length === 0 ? 'Select at least one model.' : note}
        </p>
        <div className="flex items-center gap-2">
          {onAllowAll ? (
            <Button variant="ghost" onClick={onAllowAll} disabled={saving}>
              Allow all models
            </Button>
          ) : null}
          <Button variant="outline" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={() => onSave(selected)} disabled={saving || selected.length === 0}>
            {saving ? 'Saving…' : 'Save access'}
          </Button>
        </div>
      </div>
    </DashboardPanel>
  )
}
