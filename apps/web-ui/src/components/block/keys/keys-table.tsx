import type { ColumnDef } from '@tanstack/react-table'

import { IconKey } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import SelectInput from '@/components/block/common/select-input'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate, formatTimeAgo } from '@/lib/date'

import FilterKeys, { type KeysFilters, type KeysSortValue, SORT_OPTIONS } from './filter-keys'
import KeyActionsMenu from './key-actions-menu'

const STATUS_LABEL: Record<Models.ApiKeyStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
  restricted: 'Restricted',
}

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

interface KeysTableProps {
  /** every key, for the chip counts */
  keys: Models.ApiKey[]
  /** keys after search, status and sort */
  rows: Models.ApiKey[]
  loading: boolean
  filters: KeysFilters
  onFiltersChange: (patch: Partial<KeysFilters>) => void
  onCreate: () => void
}

export default function KeysTable({
  keys,
  rows,
  loading,
  filters,
  onFiltersChange,
  onCreate,
}: KeysTableProps) {
  // Rows arrive whole, so paging runs here; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')

  // A filter change re-pages the list, so drop a stale page index.
  const changeFilters = (patch: Partial<KeysFilters>) => {
    onFiltersChange(patch)
    void setPageParam(null)
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )
    }
    if (keys.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconKey}
          title="No API keys yet"
          description="Create a key for each tool or teammate that calls the router."
          action={
            <Button size="sm" onClick={onCreate}>
              New key
            </Button>
          }
        />
      )
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconKey}
          title="No keys match"
          description="Try another name, key or plan, or clear the status filter."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeFilters({ search: '', status: 'all' })}
            >
              Clear filters
            </Button>
          }
        />
      )
    }
    return (
      <ReactTable
        total={rows.length}
        data={rows.slice(offset, offset + limit)}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={COLUMNS}
        tableClassName="min-w-[52rem]"
      />
    )
  }

  return (
    <DashboardPanel
      icon={IconKey}
      title="Keys"
      toolbar={
        <SelectInput
          aria-label="Sort keys"
          value={filters.sort}
          onSelect={(value) => changeFilters({ sort: value as KeysSortValue })}
          className="w-44"
          options={SORT_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))}
        />
      }
    >
      {keys.length > 0 && <FilterKeys keys={keys} filters={filters} onChange={changeFilters} />}
      {renderBody()}
    </DashboardPanel>
  )
}

const COLUMNS: ColumnDef<typeof features, Models.ApiKey, unknown>[] = [
  {
    id: 'name',
    header: 'Name',
    meta: { headerClassName: 'w-[24%]', cellClassName: 'max-w-0' },
    cell: ({ row }) => (
      <>
        <Link
          to="/keys/$keyId"
          params={{ keyId: row.original.id }}
          className="block truncate rounded-sm font-medium hover:underline"
          title={row.original.name}
        >
          {row.original.name}
        </Link>
        <code className="block truncate font-mono text-xs text-muted-foreground">
          {row.original.key_preview}
        </code>
      </>
    ),
  },
  {
    id: 'plan',
    header: 'Plan',
    cell: ({ row }) => (
      <>
        <span className="block">{row.original.plan_label}</span>
        {row.original.plan_note ? (
          <span className="block text-xs text-muted-foreground">{row.original.plan_note}</span>
        ) : null}
      </>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusCell record={row.original} />,
  },
  {
    id: 'last_used',
    header: 'Last used',
    cell: ({ row }) =>
      row.original.last_used_at ? (
        <span title={formatDate(row.original.last_used_at)}>
          {formatTimeAgo(row.original.last_used_at)}
        </span>
      ) : (
        <span className="text-muted-foreground">Never</span>
      ),
  },
  {
    id: 'created',
    header: 'Created',
    meta: { cellClassName: 'text-muted-foreground' },
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
    cell: ({ row }) => <KeyActionsMenu record={row.original} showDetails />,
  },
]

function StatusCell({ record }: { record: Models.ApiKey }) {
  const toggleMutation = useMutation(queries.keys.toggleStatus())
  const enabled = record.status !== 'disabled'

  const handleToggle = async (on: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: record.id, disabled: !on })
      toast.success(`Key ${on ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Switch
        checked={enabled}
        disabled={toggleMutation.isPending}
        onCheckedChange={(on) => void handleToggle(on)}
        aria-label={`${record.name} enabled`}
      />
      <span className="text-xs text-muted-foreground">{STATUS_LABEL[record.status]}</span>
    </span>
  )
}
