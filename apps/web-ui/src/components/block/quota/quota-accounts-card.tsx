import type { ColumnDef } from '@tanstack/react-table'

import { IconGauge, IconUsers } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import { features } from '@/components/block/common/react-table'
import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { QuotaAccountColumn } from './column'
import FilterQuota, { type QuotaFilters } from './filter-quota'
import { TEAL_CHIP } from './quota-stat-strip'

type ColumnType = ColumnDef<typeof features, Models.QuotaAccount, unknown>

interface QuotaAccountsCardProps {
  /** Full unfiltered list, for the component header, chips and provider list. */
  accounts: Models.QuotaAccount[]
  /** Filtered rows for the current page. */
  paged: Models.QuotaAccount[]
  /** Filtered row count. */
  total: number
  loading: boolean
  pageIndex: number
  pageSize: number
  filters: QuotaFilters
  onChange: (patch: Partial<QuotaFilters>) => void
}

/** Accounts card: header, filter row and the quota table. */
export default function QuotaAccountsCard({
  accounts,
  paged,
  total,
  loading,
  pageIndex,
  pageSize,
  filters,
  onChange,
}: QuotaAccountsCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const rows = paged

  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows])
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const someSelected = selectedVisible.length > 0 && !allVisibleSelected

  const toggleVisible = useCallback(() => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }, [allVisibleSelected, visibleIds])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const toggleMutation = useMutation(queries.quota.toggleStatus())

  const bulkToggle = useCallback(
    async (pause: boolean) => {
      const ids = [...selected]
      try {
        for (const id of ids) await toggleMutation.mutateAsync(id)
        toast.success(`Account${ids.length > 1 ? 's' : ''} ${pause ? 'paused' : 'activated'}`)
        setSelected(new Set())
      } catch (error) {
        toastAxiosError(error as Error)
      }
    },
    [selected, toggleMutation]
  )

  const selectionColumns = useMemo<ColumnType[]>(() => {
    const selection: ColumnType = {
      id: 'selection',
      size: 36,
      header: () => (
        <Checkbox
          aria-label="Select all rows"
          checked={allVisibleSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={() => toggleVisible()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={selected.has(row.original.id)}
          onCheckedChange={() =>
            setSelected((previous) => {
              const next = new Set(previous)
              if (next.has(row.original.id)) next.delete(row.original.id)
              else next.add(row.original.id)
              return next
            })
          }
        />
      ),
    }

    return [selection]
  }, [allVisibleSelected, someSelected, selected, toggleVisible])

  // QuotaAccountColumn runs its own useMemo, so it must stay in the render
  // body — nesting it inside the memo above breaks React's hook order.
  const columns = [...selectionColumns, ...QuotaAccountColumn({ loading })]

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`${TEAL_CHIP} flex size-6 items-center justify-center rounded-md`}>
            <IconUsers className="size-3.5" aria-hidden />
          </span>
          <h2 className="truncate text-[13px] font-semibold">Accounts</h2>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {accounts.length} accounts
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <FilterQuota filters={filters} onChange={onChange} accounts={accounts} />
      </div>

      {selected.size > 0 && (
        <div className="bg-muted/30 flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <span className="text-xs font-medium tabular-nums">{selected.size} selected</span>
          <Button
            disabled={toggleMutation.isPending}
            onClick={() => bulkToggle(true)}
            size="xs"
            variant="outline"
          >
            Pause
          </Button>
          <Button
            disabled={toggleMutation.isPending}
            onClick={() => bulkToggle(false)}
            size="xs"
            variant="outline"
          >
            Activate
          </Button>
          <Button onClick={clearSelection} size="xs" variant="ghost">
            Clear
          </Button>
        </div>
      )}

      <ReactTable
        total={total}
        data={rows}
        pageIndex={pageIndex}
        pageSize={pageSize}
        columns={columns}
        emptyMessage={
          <EmptyState
            icon={IconGauge}
            title={accounts.length === 0 ? 'No accounts yet' : 'No accounts match'}
            description={
              accounts.length === 0
                ? 'Connect a provider account to track its quota here.'
                : 'Try a different search or filter.'
            }
            className="py-8"
          />
        }
      />
    </section>
  )
}
